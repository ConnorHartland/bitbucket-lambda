/**
 * Teams Client Module
 * Posts formatted messages to Microsoft Teams Workflow webhook
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

export async function postToTeams(
  eventData: Record<string, any>,
  webhookUrl: string
): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.status === 200 || response.status === 202) {
      return true;
    }

    const responseBody = await response.text();
    console.error(`Teams API posting failed with status ${response.status}: ${responseBody}`);
    return false;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error('Teams API posting timeout after 10 seconds');
    } else {
      console.error(`Teams API posting failed with error: ${error}`);
    }

    return false;
  }
}
