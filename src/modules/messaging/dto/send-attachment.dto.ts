import { IsOptional, IsString, MaxLength } from 'class-validator';

// EF-MSG-03 — the multipart body accompanying an uploaded attachment. The file
// travels as the `file` part; `body` is an optional caption (a standalone
// attachment message has no caption).
export class SendAttachmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  body?: string;
}
