import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { randomInt } from "node:crypto";
import { CreateLoanApplicationDto } from "./dto/create-loan-application.dto";
import { LoanApplication } from "./loan-application.model";
import { resolvePagination } from "../common/utils/pagination";
import { Op, Sequelize } from "sequelize";
import { EncryptionService } from "src/common/decorators/crypto/encryption.service";

/** Ambiguous glyphs (I, O, 0, 1) omitted so references survive being read aloud. */
const REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type SubmissionContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class LoanApplicationsService {
  constructor(
    @InjectModel(LoanApplication)
    private readonly model: typeof LoanApplication,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Generates a collision-resistant reference. Uses `randomInt` rather than
   * `Math.random` so references are not predictable from one another — a
   * guessable reference would let anyone enumerate applications by phone.
   */
  private generateReference(): string {
    let suffix = "";
    for (let i = 0; i < 8; i += 1) {
      suffix += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
    }
    return `LL-${suffix}`;
  }

  async create(
    dto: CreateLoanApplicationDto,
    context: SubmissionContext = {},
  ): Promise<LoanApplication> {
    const consented = dto.smsConsent === true;

    // Retry on the (vanishingly unlikely) unique-constraint collision rather
    // than pre-checking, which would still race.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.model.create({
          reference: this.generateReference(),
          amountRequested: dto.amountRequested.toFixed(2),
          purpose: dto.purpose,
          termMonths: dto.termMonths,
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          street: dto.street,
          city: dto.city,
          state: dto.state,
          postalCode: dto.postalCode,
          bankName: this.encryption.encrypt(dto.bankName),
          routingNumber: this.encryption.encrypt(dto.routingNumber),
          accountNumber: this.encryption.encrypt(dto.accountNumber),
          bankAccountAge: dto.bankAccountAge,
          accountStatus: dto.accountStatus,
          smsConsent: consented,
          smsConsentAt: consented ? new Date() : null,
          smsConsentText: consented ? (dto.smsConsentText ?? null) : null,
          consentIp: consented ? (context.ipAddress ?? null) : null,
          consentUserAgent: consented ? (context.userAgent ?? null) : null,
          status: "received",
        } as Partial<LoanApplication> as LoanApplication);
      } catch (error) {
        const isDuplicateReference =
          error instanceof Error &&
          error.name === "SequelizeUniqueConstraintError";

        if (!isDuplicateReference || attempt === 4) throw error;
      }
    }

    throw new Error("Could not allocate a unique application reference");
  }

  async findByReference(reference: string): Promise<LoanApplication> {
    const found = await this.model.findOne({
      where: { reference: reference.toUpperCase() },
    });

    if (!found) throw new NotFoundException("Application not found");

    return found;
  }

  async countAll(): Promise<number> {
    return this.model.count();
  }

  async getByIdAdminAccess(reference: string) {
    try {
      const application = await this.model.findOne({
        where: { reference: reference },
      });

      if (!application) {
        throw new NotFoundException("Loan application not found");
      }
      const bankName = application?.bankName
        ? this.encryption.decrypt(application?.bankName)
        : "";
      const routingNumber = application?.routingNumber
        ? this.encryption.decrypt(application?.routingNumber)
        : "";
      const accountNumber = application?.accountNumber
        ? this.encryption.decrypt(application?.accountNumber)
        : "";
      return {
        ...application.toJSON(),
        bankName,
        routingNumber,
        accountNumber,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error("Error fetching loan application by ID:", error);
      throw new InternalServerErrorException(
        "Could not fetch loan application",
      );
    }
  }

  async getAll(filters?: {
    date?: string;
    q?: string;
    tzOffset?: number;
    page?: number;
    limit?: number;
  }) {
    try {
      const where: any = {};

      if (filters?.date) {
        // tzOffset is minutes returned by JS Date.getTimezoneOffset() on the
        // client (UTC - local, e.g. 420 for PDT). Shift the UTC boundaries so
        // the range covers the user's local calendar day.
        const offsetMs = (filters.tzOffset ?? 0) * 60 * 1000;
        const start = new Date(
          new Date(`${filters.date}T00:00:00.000Z`).getTime() + offsetMs,
        );
        const end = new Date(
          new Date(`${filters.date}T23:59:59.999Z`).getTime() + offsetMs,
        );
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          where.created_at = { [Op.between]: [start, end] };
        }
      }

      console.log("filters:", filters);
      console.log("q:", filters?.q);

      const search = filters?.q?.trim() ?? "";

      if (search) {
        const like = `%${search}%`;

        where[Op.or] = [
          Sequelize.where(
            Sequelize.fn(
              "concat",
              Sequelize.col("first_name"),
              " ",
              Sequelize.col("last_name"),
            ),
            {
              [Op.iLike]: like,
            },
          ),
          { first_name: { [Op.iLike]: like } },
          { last_name: { [Op.iLike]: like } },
          { email: { [Op.iLike]: like } },
          { reference: { [Op.iLike]: like } },
        ];

        const normalizedPhone = search.replace(/\D/g, "");

        if (normalizedPhone.length >= 7) {
          where[Op.or].push(
            Sequelize.where(
              Sequelize.fn(
                "regexp_replace",
                Sequelize.col("phone"),
                "\\D",
                "",
                "g",
              ),
              {
                [Op.like]: `%${normalizedPhone}%`,
              },
            ),
          );
        }
      }

      const { page, limit, offset } = resolvePagination(
        filters?.page,
        filters?.limit,
      );

      const { rows, count } = await this.model.findAndCountAll({
        where,
        order: [["created_at", "DESC"]],
        limit,
        offset,
      });

      return { applications: rows, total: count, page, limit };
    } catch (error) {
      // Previously this swallowed the error and returned undefined, so the
      // controller answered 200 with an empty body on a failed query.
      console.error("Error fetching all loan applications:", error);
      throw new InternalServerErrorException(
        "Could not fetch loan applications",
      );
    }
  }
}
