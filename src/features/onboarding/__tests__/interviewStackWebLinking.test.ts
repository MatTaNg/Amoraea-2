import {
  isInterviewAliasWebPath,
  shouldRedirectWebPathToPreferredRoute,
} from '../interviewStackWebLinking';

describe('interviewStackWebLinking', () => {
  it('treats root and /interview as interview aliases', () => {
    expect(isInterviewAliasWebPath('/')).toBe(true);
    expect(isInterviewAliasWebPath('/interview')).toBe(true);
  });

  it('does not redirect /interview to welcome when server prefers AssessmentWelcome', () => {
    expect(shouldRedirectWebPathToPreferredRoute('/interview', 'AssessmentWelcome')).toBe(false);
  });

  it('redirects bare root to welcome when server prefers AssessmentWelcome', () => {
    expect(shouldRedirectWebPathToPreferredRoute('/', 'AssessmentWelcome')).toBe(true);
  });
});
