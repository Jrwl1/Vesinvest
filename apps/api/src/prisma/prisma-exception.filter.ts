import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientKnownRequestError,
)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Connection errors return 503
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      this.logger.warn(`DB not ready: ${exception.message}`);
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: 'Database not ready',
        error: 'Service Unavailable',
      });
    }

    // Known request errors (e.g., connection lost mid-request)
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P1001' || exception.code === 'P1002') {
        this.logger.warn(`DB connection error: ${exception.code}`);
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message: 'Database not ready',
          error: 'Service Unavailable',
        });
      }
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      this.logger.warn(
        `Prisma error: code=${prismaError.code} message=${
          prismaError.message
        } meta=${JSON.stringify(prismaError.meta)}`,
      );

      // User-facing 4xx for constraint violations
      if (prismaError.code === 'P2002') {
        const meta = prismaError.meta as
          | { target?: string[]; modelName?: string }
          | undefined;
        this.logger.warn(
          `[P2002] code=${prismaError.code} target=${JSON.stringify(
            meta?.target,
          )} modelName=${meta?.modelName ?? 'n/a'} message=${
            prismaError.message
          }`,
        );
        const target = meta?.target as string[] | undefined;
        const targetSet = new Set(target ?? []);
        // Old DB: unique was (orgId, vuosi) only → one budget per year; suggest migrations
        const isOldBudgetConstraint =
          target &&
          target.length === 2 &&
          targetSet.has('orgId') &&
          targetSet.has('vuosi');
        const msg = isOldBudgetConstraint
          ? 'Only one budget per year is allowed. Run database migrations (unique on orgId+vuosi+nimi) to allow multiple budgets per year.'
          : target?.length
          ? `A budget with this name and year already exists (${target.join(
              ', ',
            )}).`
          : 'A record with this value already exists';
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: msg,
          error: 'Conflict',
        });
      }
      if (prismaError.code === 'P2003') {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message:
            'A related record was not found. Check that the organization and budget exist.',
          error: 'Bad Request',
        });
      }
      if (prismaError.code === 'P2011' || prismaError.code === 'P2012') {
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid or missing required value',
          error: 'Bad Request',
        });
      }
      if (prismaError.code === 'P2021') {
        return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          message:
            'Database schema is out of date. Run migrations and retry the request.',
          error: 'Service Unavailable',
          code: 'DB_SCHEMA_OUTDATED',
        });
      }

      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message:
          'An error occurred while saving. Please try again or contact support.',
        error: 'Internal Server Error',
      });
    }

    throw exception;
  }
}
