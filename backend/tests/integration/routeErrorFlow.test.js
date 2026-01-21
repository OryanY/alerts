const request = require('supertest');
const express = require('express');
const { errorMiddleware } = require('../../middleware/errorHandler');

// Mock Services
const mockAlertServiceGetAlerts = jest.fn();
const mockIncidentServiceGetGroups = jest.fn();

// Mock dependencies BEFORE importing routes
jest.mock('../../services/alert/AlertService', () => {
    return jest.fn().mockImplementation(() => ({
        getAlerts: mockAlertServiceGetAlerts
    }));
});

jest.mock('../../services/incident/IncidentService', () => {
    return jest.fn().mockImplementation(() => ({
        getAssignmentGroups: mockIncidentServiceGetGroups
    }));
});

// Import Routes (mocked services will be used)
const alertRoutes = require('../../routes/alertRoutes');
const incidentRoutes = require('../../routes/incidentRoutes');

describe('Route Error Handling Integration', () => {
    let app;

    beforeEach(() => {
        // Setup minimal Express app with real middleware
        app = express();
        app.use(express.json());

        // Mount Routes
        app.use('/api/alerts', alertRoutes);
        app.use('/api/incidents', incidentRoutes);

        // Mount Error Handler (The Verification Target)
        app.use(errorMiddleware);

        // Reset mocks
        jest.clearAllMocks();
    });

    describe('Alert Routes (via createCachedHandler)', () => {
        it('should catch Service errors and return 500 JSON', async () => {
            // Arrange: Force Service to throw generic error
            mockAlertServiceGetAlerts.mockRejectedValue(new Error('Database Connection Failed'));

            // Act
            const response = await request(app).get('/api/alerts');

            // Assert
            expect(response.status).toBe(500);
            expect(response.body).toEqual(expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred'
                })
            }));
        });

        it('should catch Joi Validation errors and return 400 JSON', async () => {
            // Arrange: Trigger validation error by sending invalid query param
            // Note: Alerts schema usually allows optional params, but let's try sending bad types if possible
            // Actually, schemas allow strings mostly.
            // Let's force a validation error by mocking the schema? No, that's too meta.
            // Let's assume sending a clearly invalid date format if schema validation is strict.
            // Or use mocked implementation to throw a specific ValidationError-like object

            // Wait, createCachedHandler runs validation FIRST.
            // If we send ?limit=notanumber, it should fail Joi validation (limit is number)

            // Act
            const response = await request(app).get('/api/alerts?limit=notanumber');

            // Assert
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Incident Routes (via explicit try/catch)', () => {
        it('should catch Service errors and return 500 JSON', async () => {
            // Arrange: Force Service to throw
            mockIncidentServiceGetGroups.mockRejectedValue(new Error('ServiceNow Unreachable'));

            // Act
            const response = await request(app).get('/api/incidents/assignment-groups');

            // Assert
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error.code).toBe('INTERNAL_ERROR');
        });
    });
});
