import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CompanyStatus {
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

export enum CompanySize {
  MICRO = '1-10',
  SMALL = '11-50',
  MEDIUM = '51-200',
  LARGE = '201-500',
  ENTERPRISE = '500+',
}

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true })
  registrationNumber!: string | null;

  @Column({ type: 'varchar', nullable: true, unique: true })
  ice!: string | null;

  @Column({ default: false })
  verified!: boolean;

  // Public-facing company profile fields ("Mon Entreprise"), also reused by
  // the landing "Ils nous ont fait confiance" section. All nullable: a
  // company can exist (created at recruiter signup) before it fills these in.
  @Column({ type: 'varchar', nullable: true })
  logo!: string | null;

  @Column({ type: 'varchar', nullable: true })
  sector!: string | null;

  @Column({ type: 'enum', enum: CompanySize, nullable: true })
  size!: CompanySize | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.PENDING_VERIFICATION,
  })
  status!: CompanyStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
