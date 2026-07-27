import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Role } from '../../../common/enums/role.enum.js';
import { RefreshToken } from './refresh-token.entity.js';

export enum UserStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DELETED = 'deleted',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  @Index()
  email!: string;

  @Column({ name: 'password_hash' })
  passwordHash!: string;

  @Column({
    type: 'enum',
    enum: Role,
    array: true,
    default: [Role.CANDIDATE],
  })
  roles!: Role[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING_VERIFICATION,
  })
  status!: UserStatus;

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ name: 'email_verification_token', nullable: true })
  emailVerificationToken!: string | null;

  @Column({
    name: 'email_verification_expires',
    type: 'timestamptz',
    nullable: true,
  })
  emailVerificationExpires!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens!: RefreshToken[];
}
