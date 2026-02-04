import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientInitializationError, Prisma.PrismaClientKnownRequestError)
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
      this.logger.warn(`Prisma error ${exception.code}: ${exception.message}`);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'An error occurred while saving. Please try again or contact support.',
        error: 'Internal Server Error',
      });
    }

    throw exception;
  }
}
