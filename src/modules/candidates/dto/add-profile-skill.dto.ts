import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AddProfileSkillDto {
  @IsUUID()
  skillId!: string;

  @IsOptional()
  @IsString()
  level?: string;
}
