"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Test setup file
const dotenv_1 = __importDefault(require("dotenv"));
// Load test environment variables
dotenv_1.default.config({ path: '.env.test' });
// Global test configuration
beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
});
afterAll(() => {
    // Cleanup after all tests
});
// Global mocks
jest.mock('@devplan/common', () => ({
    ...jest.requireActual('@devplan/common'),
    logInfo: jest.fn(),
    logError: jest.fn(),
}));
// Mock fetch globally
global.fetch = jest.fn();
// Reset mocks between tests
beforeEach(() => {
    jest.clearAllMocks();
});
//# sourceMappingURL=setup.js.map