export interface Vote {
  number: number;
  comment: 'yes' | 'no';
  from: string;
}

export abstract class VoteProvider {
  constructor(readonly repo: string) {}
  abstract insertVote(vote: Vote): Promise<void>;
  abstract getVotes(): Promise<Vote[]>;
}