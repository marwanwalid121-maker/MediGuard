/**
 * API Client Service
 * Handles all HTTP requests to backend APIs
 * Includes error handling and token management
 */

export class ApiClient {
  /**
   * POST request
   */
  static async post(url: string, data: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });

      // Try to parse response body
      let responseData;
      try {
        responseData = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, return a generic error
        console.error('Failed to parse response:', parseError);
        return { success: false, error: 'Invalid server response' };
      }

      // For 401 (Unauthorized), return the error response instead of throwing
      if (response.status === 401) {
        return responseData; // Return { success: false, error: "Invalid credentials" }
      }

      // For other errors, throw
      if (!response.ok) {
        console.error(`HTTP Error ${response.status}:`, responseData);
        return { success: false, error: responseData.error || `HTTP Error: ${response.status}` };
      }

      return responseData;
    } catch (error) {
      console.error(`POST request failed for ${url}:`, error);
      // Return error object instead of throwing
      return { success: false, error: 'Network error. Please check if the server is running.' };
    }
  }

  /**
   * GET request
   */
  static async get(url: string, token?: string) {
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`GET request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * PUT request
   */
  static async put(url: string, data: any, token?: string) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`PUT request failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * DELETE request
   */
  static async delete(url: string, token?: string) {
    const headers: any = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`DELETE request failed for ${url}:`, error);
      throw error;
    }
  }
}

/**
 * Build URL from base API and endpoint
 */
export function buildUrl(baseApi: string, endpoint: string): string {
  if (!endpoint.startsWith('/')) {
    endpoint = '/' + endpoint;
  }
  return `${baseApi}${endpoint}`;
}
