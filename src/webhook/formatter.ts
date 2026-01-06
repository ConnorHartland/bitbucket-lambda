/**
 * Message formatting for Teams notifications
 * Converts failure events into Teams Adaptive Card JSON
 */

import { FailureEvent } from '../types';

/**
 * Format a failure event into a Teams Adaptive Card message
 * Includes pipeline name, repository, branch, triggered by, and status
 *
 * @param failure The failure event to format
 * @returns Teams Adaptive Card payload
 */
export function formatMessage(failure: FailureEvent): Record<string, any> {
  const statusEmoji = failure.status === 'FAILED' ? '❌' : '⚠️';
  const statusColor = failure.status === 'FAILED' ? 'Attention' : 'Warning';

  // Ensure all values are strings and not empty
  const repository = String(failure.repository || 'unknown').trim() || 'unknown';
  const branch = String(failure.branch || 'unknown').trim() || 'unknown';
  const pipelineName = String(failure.pipelineName || 'Pipeline').trim() || 'Pipeline';
  const author = String(failure.author || 'unknown').trim() || 'unknown';
  const status = String(failure.status || 'UNKNOWN').trim() || 'UNKNOWN';
  const reason = String(failure.reason || 'No details available').trim() || 'No details available';

  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'Container',
        style: 'default',
        items: [
          {
            type: 'ColumnSet',
            columns: [
              {
                type: 'Column',
                width: 'stretch',
                items: [
                  {
                    type: 'TextBlock',
                    text: '🔧 **Pipeline Status**',
                    weight: 'Bolder',
                    size: 'Large',
                    wrap: true,
                    color: 'Accent',
                  },
                  {
                    type: 'TextBlock',
                    text: pipelineName,
                    weight: 'Default',
                    size: 'Medium',
                    wrap: true,
                    color: statusColor,
                    spacing: 'Small',
                  },
                ],
                verticalContentAlignment: 'Center',
              },
              {
                type: 'Column',
                width: 'auto',
                items: [
                  {
                    type: 'TextBlock',
                    text: statusEmoji,
                    size: 'ExtraLarge',
                    horizontalAlignment: 'Center',
                  },
                ],
                verticalContentAlignment: 'Center',
              },
            ],
          },
        ],
      },
      {
        type: 'Container',
        items: [
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Repository',
                value: repository,
              },
              {
                title: 'Branch',
                value: branch,
              },
              {
                title: 'Pipeline',
                value: pipelineName,
              },
              {
                title: 'Triggered by',
                value: author,
              },
              {
                title: 'Status',
                value: status,
              },
            ],
          },
        ],
        spacing: 'Medium',
      },
      {
        type: 'Container',
        items: [
          {
            type: 'TextBlock',
            text: `🚨 ${author} - ${reason}`,
            wrap: true,
            size: 'Default',
            isSubtle: true,
          },
        ],
        spacing: 'Medium',
      },
    ],
    actions: [
      {
        type: 'Action.OpenUrl',
        title: '🔍 View Pipeline Logs',
        url: failure.link || '#',
      },
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  };
}
