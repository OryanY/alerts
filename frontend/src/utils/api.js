// utils/api.js — Single source of truth for API/fetch helpers

/**
 * Safely parses JSON from a fetch response.
 * Handles empty bodies (like 401 challenges from Windows Auth) gracefully.
 * @param {Response} res - Fetch Response object
 * @returns {Promise<Object>} Parsed JSON or empty object
 */
export const safeJson = async (res) => {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch (e) {
        console.warn('Failed to parse JSON:', text.substring(0, 100));
        return {};
    }
};
