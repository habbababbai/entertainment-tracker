import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import LoginScreen from "../components/LoginScreen";
import { loginUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
        canGoBack: jest.fn(() => true),
    }),
}));

jest.mock("../lib/auth", () => ({
    loginUser: jest.fn(),
}));

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

const loginUserMock = loginUser as jest.MockedFunction<typeof loginUser>;
const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;

const mockSetAuthFromResponse = jest.fn();

function renderLoginScreen() {
    return render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
            }}
        >
            <LoginScreen />
        </SafeAreaProvider>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    useAuthStoreMock.mockReturnValue(mockSetAuthFromResponse);
});

afterEach(() => {
    cleanup();
});

describe("LoginScreen UI", () => {
    it("renders login form with email and password inputs", () => {
        const { getByPlaceholderText, getByText } = renderLoginScreen();

        expect(getByPlaceholderText("Enter your email")).toBeTruthy();
        expect(getByPlaceholderText("Enter your password")).toBeTruthy();
        expect(getByText("Welcome Back")).toBeTruthy();
        expect(getByText("Sign in to continue")).toBeTruthy();
        expect(getByText("Sign In")).toBeTruthy();
    });

    it("updates email input when user types", () => {
        const { getByPlaceholderText } = renderLoginScreen();
        const emailInput = getByPlaceholderText("Enter your email");

        fireEvent.changeText(emailInput, "test@example.com");

        expect(emailInput.props.value).toBe("test@example.com");
    });

    it("updates password input when user types", () => {
        const { getByPlaceholderText } = renderLoginScreen();
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(passwordInput, "password123");

        expect(passwordInput.props.value).toBe("password123");
    });

    it("clears error when user starts typing in email field", async () => {
        const { getByPlaceholderText, queryByText, getByText } =
            renderLoginScreen();
        const emailInput = getByPlaceholderText("Enter your email");

        fireEvent.press(getByText("Sign In"));

        await waitFor(() => {
            expect(
                queryByText(/Please enter both email and password/)
            ).toBeTruthy();
        });

        fireEvent.changeText(emailInput, "new@example.com");

        await waitFor(() => {
            expect(
                queryByText(/Please enter both email and password/)
            ).toBeNull();
        });
    });

    it("clears error when user starts typing in password field", async () => {
        const { getByPlaceholderText, queryByText, getByText } =
            renderLoginScreen();
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.press(getByText("Sign In"));

        await waitFor(() => {
            expect(
                queryByText(/Please enter both email and password/)
            ).toBeTruthy();
        });

        fireEvent.changeText(passwordInput, "newpassword");

        await waitFor(() => {
            expect(
                queryByText(/Please enter both email and password/)
            ).toBeNull();
        });
    });

    it("shows error when login button is pressed with empty fields", async () => {
        const { getByText, findByText } = renderLoginScreen();

        const loginButton = getByText("Sign In");
        fireEvent.press(loginButton);

        expect(
            await findByText("Please enter both email and password")
        ).toBeTruthy();
        expect(loginUserMock).not.toHaveBeenCalled();
    });

    it("shows error when email is empty", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderLoginScreen();

        const passwordInput = getByPlaceholderText("Enter your password");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        fireEvent.press(loginButton);

        expect(
            await findByText("Please enter both email and password")
        ).toBeTruthy();
        expect(loginUserMock).not.toHaveBeenCalled();
    });

    it("shows error when password is empty", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        fireEvent.changeText(emailInput, "test@example.com");

        const loginButton = getByText("Sign In");
        fireEvent.press(loginButton);

        expect(
            await findByText("Please enter both email and password")
        ).toBeTruthy();
        expect(loginUserMock).not.toHaveBeenCalled();
    });

    it("trims email before submitting", async () => {
        const mockResponse = {
            user: {
                id: "user-1",
                email: "test@example.com",
                username: "testuser",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
            accessToken: "access-token",
            refreshToken: "refresh-token",
        };

        loginUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "  test@example.com  ");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        await waitFor(() => {
            expect(loginUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "password123",
            });
        });
    });

    it("calls loginUser and setAuthFromResponse on successful login", async () => {
        const mockResponse = {
            user: {
                id: "user-1",
                email: "test@example.com",
                username: "testuser",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
            accessToken: "access-token",
            refreshToken: "refresh-token",
        };

        loginUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        await waitFor(() => {
            expect(loginUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "password123",
            });
            expect(mockSetAuthFromResponse).toHaveBeenCalledWith(mockResponse);
        });
    });

    it("shows loading state during login", async () => {
        let resolveLogin: (value: typeof mockResponse) => void;
        const loginPromise = new Promise<typeof mockResponse>((resolve) => {
            resolveLogin = resolve;
        });

        const mockResponse = {
            user: {
                id: "user-1",
                email: "test@example.com",
                username: "testuser",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
            accessToken: "access-token",
            refreshToken: "refresh-token",
        };

        loginUserMock.mockImplementationOnce(() => loginPromise);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText, queryByText } =
            renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        expect(queryByText("Sign In")).toBeNull();

        await act(async () => {
            resolveLogin!(mockResponse);
            await loginPromise;
        });

        await waitFor(() => {
            expect(queryByText("Sign In")).toBeTruthy();
        });
    });

    it("disables inputs during login", async () => {
        let resolveLogin: (value: typeof mockResponse) => void;
        const loginPromise = new Promise<typeof mockResponse>((resolve) => {
            resolveLogin = resolve;
        });

        const mockResponse = {
            user: {
                id: "user-1",
                email: "test@example.com",
                username: "testuser",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
            accessToken: "access-token",
            refreshToken: "refresh-token",
        };

        loginUserMock.mockImplementationOnce(() => loginPromise);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        expect(emailInput.props.editable).toBe(false);
        expect(passwordInput.props.editable).toBe(false);

        await act(async () => {
            resolveLogin!(mockResponse);
            await loginPromise;
        });

        await waitFor(() => {
            expect(emailInput.props.editable).toBe(true);
            expect(passwordInput.props.editable).toBe(true);
        });
    });

    it("shows error message when login fails", async () => {
        const errorMessage = "Invalid credentials";
        loginUserMock.mockRejectedValueOnce(new Error(errorMessage));

        const { getByPlaceholderText, getByText, findByText } =
            renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "wrongpassword");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        expect(await findByText(errorMessage)).toBeTruthy();
        expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
    });

    it("handles login failure with empty error message", async () => {
        loginUserMock.mockRejectedValueOnce(new Error(""));

        const { getByPlaceholderText, getByText } = renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        await waitFor(() => {
            expect(loginUserMock).toHaveBeenCalled();
            expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
        });
    });

    it("shows generic error message when login fails with non-Error object", async () => {
        loginUserMock.mockRejectedValueOnce("String error");

        const { getByPlaceholderText, getByText, findByText } =
            renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const loginButton = getByText("Sign In");
        await act(async () => {
            fireEvent.press(loginButton);
        });

        expect(
            await findByText("Login failed. Please try again.")
        ).toBeTruthy();
    });

    it("submits form when password input is submitted", async () => {
        const mockResponse = {
            user: {
                id: "user-1",
                email: "test@example.com",
                username: "testuser",
                createdAt: "2024-01-01T00:00:00.000Z",
                updatedAt: "2024-01-01T00:00:00.000Z",
            },
            accessToken: "access-token",
            refreshToken: "refresh-token",
        };

        loginUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText } = renderLoginScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        await act(async () => {
            fireEvent(passwordInput, "submitEditing");
        });

        await waitFor(() => {
            expect(loginUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "password123",
            });
        });
    });

    it("navigates to register screen when Sign Up link is pressed", () => {
        const { getByText } = renderLoginScreen();

        const signUpLink = getByText("Sign Up");
        fireEvent.press(signUpLink);

        expect(mockPush).toHaveBeenCalledWith("/register");
    });

    it("displays Sign Up link in footer", () => {
        const { getByText } = renderLoginScreen();

        expect(getByText("Don't have an account?")).toBeTruthy();
        expect(getByText("Sign Up")).toBeTruthy();
    });
});
