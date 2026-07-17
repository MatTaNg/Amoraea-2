import { describe, expect, it, jest, beforeEach } from '@jest/globals';

jest.mock('../generatePartialReport', () => ({
  buildPartialReportHtml: jest.fn(),
}));

import { buildPartialReportHtml } from '../generatePartialReport';
import {
  clearPartialReportCache,
  getCachedPartialReportHtml,
  prefetchPartialReport,
} from '../partialReportPrefetch';

const buildMock = buildPartialReportHtml as jest.MockedFunction<typeof buildPartialReportHtml>;

describe('partialReportPrefetch', () => {
  beforeEach(() => {
    clearPartialReportCache();
    buildMock.mockReset();
  });

  it('does not reuse a rejected promise after failure', async () => {
    buildMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('<html>ok</html>');

    await expect(prefetchPartialReport('user-1')).rejects.toThrow('boom');
    expect(getCachedPartialReportHtml('user-1')).toBeNull();

    await expect(prefetchPartialReport('user-1')).resolves.toBe('<html>ok</html>');
    expect(getCachedPartialReportHtml('user-1')).toBe('<html>ok</html>');
    expect(buildMock).toHaveBeenCalledTimes(2);
  });
});
