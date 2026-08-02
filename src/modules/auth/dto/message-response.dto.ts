import { ApiProperty } from '@nestjs/swagger';

// Documentation-only, same reasoning as AuthTokensResponseDto — the
// {message: string} shape returned by verify-email (and reused nowhere
// else internally; register's response gets its own dto, see below).
export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}
