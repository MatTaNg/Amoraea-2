import { describe, expect, it } from '@jest/globals';
import { sexualCommunicationBand } from '../postInterviewSexualCommunicationService';

describe('sexualCommunicationBand', () => {
  it('labels low communication comfort below 2.5', () => {
    expect(sexualCommunicationBand(2.4).band).toBe('Low communication comfort');
  });

  it('labels moderate communication comfort from 2.5 to 3.49', () => {
    expect(sexualCommunicationBand(2.5).band).toBe('Moderate communication comfort');
    expect(sexualCommunicationBand(3.49).band).toBe('Moderate communication comfort');
  });

  it('labels high communication comfort from 3.5 upward', () => {
    expect(sexualCommunicationBand(3.5).band).toBe('High communication comfort');
    expect(sexualCommunicationBand(5).band).toBe('High communication comfort');
  });
});
