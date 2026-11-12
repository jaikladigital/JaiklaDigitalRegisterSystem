/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const, no-empty, react-hooks/exhaustive-deps */
export const sendNotification = async (type: 'line_notify' | 'line_messaging_api' | 'line_push' | 'sms_twilio', payload: any) => {
  try {
    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, payload }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error && errorData.error.includes('not configured')) {
        console.log(`[Notification] Skipped ${type}: ${errorData.error}`);
        return null; // Gracefully fail
      }
      throw new Error(errorData.error || `Failed to send ${type} notification`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error sending ${type} notification:`, error);
    throw error;
  }
};
