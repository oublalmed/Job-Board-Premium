import { IsIn } from 'class-validator';
import { ProfileModerationStatus } from '../entities/candidate-profile.entity.js';

// EF-ADM-01 — the admin's moderation decision on a candidate profile.
export class ModerateProfileDto {
  @IsIn([ProfileModerationStatus.ACTIVE, ProfileModerationStatus.SUSPENDED])
  status!: ProfileModerationStatus;
}
