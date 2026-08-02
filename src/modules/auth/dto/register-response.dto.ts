import { ApiProperty } from '@nestjs/swagger';

class RegisteredUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;
}

// Documentation-only, same reasoning as AuthTokensResponseDto — mirrors
// AuthService.register's actual inline return shape.
export class RegisterResponseDto {
  @ApiProperty({ type: RegisteredUserDto })
  user!: RegisteredUserDto;

  @ApiProperty()
  message!: string;
}
