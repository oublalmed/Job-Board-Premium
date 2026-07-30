import { NotFoundException } from '@nestjs/common';

export class CandidateProfileNotFoundException extends NotFoundException {
  constructor(candidateProfileId: string) {
    super(`Candidate profile ${candidateProfileId} not found`);
  }
}

// Deliberately the same message/status whether the conversation truly
// doesn't exist or the caller just isn't a party to it (wrong company, or
// not the candidate/recruiter on the thread) — existence must not leak to
// an unauthorized caller.
export class ConversationNotFoundException extends NotFoundException {
  constructor(conversationId: string) {
    super(`Conversation ${conversationId} not found`);
  }
}
