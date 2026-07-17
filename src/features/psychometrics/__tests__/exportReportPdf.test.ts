import {
  buildReportPdfFileBaseName,
  extractParticipantNameFromReportHtml,
} from '../exportReportPdf';

describe('exportReportPdf naming', () => {
  it('builds Matt Partial Report from display name', () => {
    expect(
      buildReportPdfFileBaseName({
        participantDisplayName: 'Matt',
        reportKind: 'partial',
      }),
    ).toBe('Matt Partial Report');
  });

  it('builds full personal report filename', () => {
    expect(
      buildReportPdfFileBaseName({
        participantDisplayName: 'Jordan',
        reportKind: 'full',
      }),
    ).toBe('Jordan Personal Report');
  });

  it('strips unsafe filename characters', () => {
    expect(
      buildReportPdfFileBaseName({
        participantDisplayName: 'Matt/Lee:Test',
        reportKind: 'partial',
      }),
    ).toBe('MattLeeTest Partial Report');
  });

  it('extracts name from report HTML title', () => {
    const html = '<html><head><title>Matt\'s Partial Report — Amoraea</title></head></html>';
    expect(extractParticipantNameFromReportHtml(html)).toBe('Matt');
    expect(buildReportPdfFileBaseName({ reportKind: 'partial' }, html)).toBe('Matt Partial Report');
  });

  it('falls back to Amoraea when name is missing', () => {
    expect(buildReportPdfFileBaseName({ reportKind: 'partial' })).toBe('Amoraea Partial Report');
  });
});
