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
                    text: failure.pipelineName || 'Pipeline',
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
                value: failure.repository,
              },
              {
                title: 'Branch',
                value: failure.branch || 'unknown',
              },
              {
                title: 'Pipeline',
                value: failure.pipelineName || 'Pipeline',
              },
              {
                title: 'Triggered by',
                value: failure.author,
              },
              {
                title: 'Status',
                value: failure.status,
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
            text: `🚨 ${failure.author} - ${failure.reason}`,
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
        url: failure.link,
      },
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
  };
}
