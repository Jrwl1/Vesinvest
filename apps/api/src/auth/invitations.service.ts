import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash,randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { InviteUserDto } from './dto/invite-user.dto';

@Injectable()
export class InvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private isAdminRole(roles: string[]): boolean {
    return roles.some((r) => r.toUpperCase() === 'ADMIN');
  }

  async createInvitation(
    orgId: string,
    actorUserId: string,
    actorRoles: string[],
    dto: InviteUserDto,
  ) {
    if (!this.isAdminRole(actorRoles)) {
      throw new ForbiddenException('Only admins can invite users');
    }

    const roleName = (dto.role ?? 'USER').toUpperCase();
    const expiresInHours = dto.expiresInHours ?? 48;
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    const now = Date.now();
    const expiresAt = new Date(now + expiresInHours * 60 * 60 * 1000);

    await this.prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const invite = await this.prisma.invitation.create({
      data: {
        orgId,
        email: dto.email.toLowerCase(),
        role: roleName,
        tokenHash,
        expiresAt,
        createdBy: actorUserId,
      },
    });

    return {
      id: invite.id,
      orgId: invite.orgId,
      email: invite.email,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
      inviteToken: process.env.NODE_ENV === 'production' ? undefined : token,
    };
  }

  async acceptInvitation(
    dto: AcceptInvitationDto,
  ): Promise<{ userId: string; orgId: string; roles: string[] }> {
    const tokenHash = this.hashToken(dto.token);
    const invite = await this.prisma.invitation.findFirst({
      where: { tokenHash },
    });

    if (!invite) throw new NotFoundException('Invitation not found');
    if (invite.acceptedAt)
      throw new BadRequestException('Invitation already used');
    if (invite.expiresAt.getTime() < Date.now())
      throw new UnauthorizedException('Invitation expired');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const email = invite.email.toLowerCase();

    const user = await this.prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, password: passwordHash },
    });

    const role = await this.prisma.role.upsert({
      where: { name: invite.role },
      update: {},
      create: { name: invite.role },
    });

    const existingUserRole = await this.prisma.userRole.findUnique({
      where: {
        user_id_role_id_org_id: {
          user_id: user.id,
          role_id: role.id,
          org_id: invite.orgId,
        },
      },
    });

    if (!existingUserRole) {
      await this.prisma.userRole.create({
        data: {
          user_id: user.id,
          role_id: role.id,
          org_id: invite.orgId,
        },
      });
    }

    await this.prisma.invitation.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    const roles = await this.prisma.userRole.findMany({
      where: { user_id: user.id, org_id: invite.orgId },
      include: { role: true },
    });

    return {
      userId: user.id,
      orgId: invite.orgId,
      roles: roles.map((r) => r.role.name),
    };
  }
}
