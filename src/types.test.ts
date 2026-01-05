/**
 * Basic test to verify TypeScript interfaces and project structure
 */

import { FailureEvent, Config, TeamsMessage } from './types';

describe('TypeScript Interfaces', () => {
  it('should allow creating a FailureEvent', () => {
    const event: FailureEvent = {
      type: 'build_failed',
      repository: 'team/repo',
      branch: 'main',
      pipelineName: 'CI Pipeline',
      author: 'developer',
      reason: 'Build failed',
      link: 'https://bitbucket.org/team/repo/commits/abc123',
      status: 'FAILED',
    };

    expect(event.type).toBe('build_failed');
    expect(event.repository).toBe('team/repo');
    expect(event.status).toBe('FAILED');
  });

  it('should allow creating a Config', () => {
    const config: Config = {
      teamsWebhookUrlSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook',
      bitbucketSecretArn: 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
      ipRestrictionEnabled: true,
      bitbucketIpRanges: ['104.192.136.0/21', '185.166.140.0/22', '13.200.41.128/25'],
    };

    expect(config.ipRestrictionEnabled).toBe(true);
    expect(config.bitbucketIpRanges).toHaveLength(3);
  });

  it('should allow creating a TeamsMessage', () => {
    const message: TeamsMessage = {
      title: 'Build Failed',
      description: 'Build failed in team/repo',
      link: 'https://bitbucket.org/team/repo/commits/abc123',
      color: 'FF0000',
    };

    expect(message.color).toBe('FF0000');
  });
});
