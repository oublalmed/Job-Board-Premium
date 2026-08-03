import { ApiProperty } from '@nestjs/swagger';
import { CandidateProfile } from '../entities/candidate-profile.entity.js';
import { CompletenessResultDto } from './completeness-result.dto.js';

// Documentation-only — mirrors CandidateProfileController.getMyProfile/
// updateMyProfile's actual inline return shape ({ profile, completeness
// }). The plugin already reflects CandidateProfile itself correctly
// (it's a real @Entity() class) — only the wrapping object literal was
// unreflectable.
export class ProfileWithCompletenessDto {
  @ApiProperty({ type: CandidateProfile })
  profile!: CandidateProfile;

  @ApiProperty({ type: CompletenessResultDto })
  completeness!: CompletenessResultDto;
}
