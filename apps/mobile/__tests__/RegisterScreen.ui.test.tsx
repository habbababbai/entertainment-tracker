import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import RegisterScreen from "../components/RegisterScreen";
import { registerUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("@react-native-async-storage/async-storage", () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    clear: jest.fn(),
    getAllKeys: jest.fn(),
    multiRemove: jest.fn(),
}));

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
        canGoBack: mockCanGoBack,
    }),
}));

jest.mock("../lib/auth", () => ({
    registerUser: jest.fn(),
}));

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

const registerUserMock = registerUser as jest.MockedFunction<
    typeof registerUser
>;
const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;

const mockSetAuthFromResponse = jest.fn();

function renderRegisterScreen() {
    return render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 44, right: 0, bottom: 0, left: 0 },
            }}
        >
            <RegisterScreen />
        </SafeAreaProvider>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    useAuthStoreMock.mockReturnValue(mockSetAuthFromResponse);
});

afterEach(() => {
    cleanup();
});

describe("RegisterScreen UI", () => {
    it("renders registration form with email, username, and password inputs", () => {
        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        expect(getByPlaceholderText("Enter your email")).toBeTruthy();
        expect(getByPlaceholderText("Choose a username")).toBeTruthy();
        expect(getByPlaceholderText("Enter your password")).toBeTruthy();
        expect(getByText("Create Account")).toBeTruthy();
        expect(getByText("Sign up to get started")).toBeTruthy();
        expect(getByText("Sign Up")).toBeTruthy();
    });

    it("displays back button", () => {
        const { getByText } = renderRegisterScreen();

        expect(getByText("← Back")).toBeTruthy();
    });

    it("updates email input when user types", () => {
        const { getByPlaceholderText } = renderRegisterScreen();
        const emailInput = getByPlaceholderText("Enter your email");

        fireEvent.changeText(emailInput, "test@example.com");

        expect(emailInput.props.value).toBe("test@example.com");
    });

    it("updates username input when user types", () => {
        const { getByPlaceholderText } = renderRegisterScreen();
        const usernameInput = getByPlaceholderText("Choose a username");

        fireEvent.changeText(usernameInput, "testuser");

        expect(usernameInput.props.value).toBe("testuser");
    });

    it("updates password input when user types", () => {
        const { getByPlaceholderText } = renderRegisterScreen();
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(passwordInput, "password123");

        expect(passwordInput.props.value).toBe("password123");
    });

    it("clears error when user starts typing in email field", async () => {
        const { getByPlaceholderText, queryByText, getByText } =
            renderRegisterScreen();
        const emailInput = getByPlaceholderText("Enter your email");

        fireEvent.press(getByText("Sign Up"));

        await waitFor(() => {
            expect(queryByText(/Please fill in all fields/)).toBeTruthy();
        });

        fireEvent.changeText(emailInput, "new@example.com");

        await waitFor(() => {
            expect(queryByText(/Please fill in all fields/)).toBeNull();
        });
    });

    it("shows error when register button is pressed with empty fields", async () => {
        const { getByText, findByText } = renderRegisterScreen();

        const registerButton = getByText("Sign Up");
        fireEvent.press(registerButton);

        expect(
            await findByText("Please fill in all fields")
        ).toBeTruthy();
        expect(registerUserMock).not.toHaveBeenCalled();
    });

    it("shows error when email is empty", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        fireEvent.press(registerButton);

        expect(await findByText("Please fill in all fields")).toBeTruthy();
        expect(registerUserMock).not.toHaveBeenCalled();
    });

    it("shows error when username is empty", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        fireEvent.press(registerButton);

        expect(await findByText("Please fill in all fields")).toBeTruthy();
        expect(registerUserMock).not.toHaveBeenCalled();
    });

    it("shows error when password is empty", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");

        const registerButton = getByText("Sign Up");
        fireEvent.press(registerButton);

        expect(await findByText("Please fill in all fields")).toBeTruthy();
        expect(registerUserMock).not.toHaveBeenCalled();
    });

    it("shows error when password is too short", async () => {
        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "12345");

        const registerButton = getByText("Sign Up");
        fireEvent.press(registerButton);

        expect(
            await findByText("Password must be at least 6 characters")
        ).toBeTruthy();
        expect(registerUserMock).not.toHaveBeenCalled();
    });

    it("trims email and username before submitting", async () => {
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

        registerUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "  test@example.com  ");
        fireEvent.changeText(usernameInput, "  testuser  ");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        await waitFor(() => {
            expect(registerUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                username: "testuser",
                password: "password123",
            });
        });
    });

    it("calls registerUser and setAuthFromResponse on successful registration", async () => {
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

        registerUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        await waitFor(() => {
            expect(registerUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                username: "testuser",
                password: "password123",
            });
            expect(mockSetAuthFromResponse).toHaveBeenCalledWith(mockResponse);
            expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
        });
    });

    it("navigates to settings after successful registration", async () => {
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

        registerUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
        });
    });

    it("shows loading state during registration", async () => {
        let resolveRegister: (value: typeof mockResponse) => void;
        const registerPromise = new Promise<typeof mockResponse>((resolve) => {
            resolveRegister = resolve;
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

        registerUserMock.mockImplementationOnce(() => registerPromise);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText, queryByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        expect(queryByText("Sign Up")).toBeNull();

        await act(async () => {
            resolveRegister!(mockResponse);
            await registerPromise;
        });

        await waitFor(() => {
            expect(queryByText("Sign Up")).toBeTruthy();
        });
    });

    it("disables inputs during registration", async () => {
        let resolveRegister: (value: typeof mockResponse) => void;
        const registerPromise = new Promise<typeof mockResponse>((resolve) => {
            resolveRegister = resolve;
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

        registerUserMock.mockImplementationOnce(() => registerPromise);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        expect(emailInput.props.editable).toBe(false);
        expect(usernameInput.props.editable).toBe(false);
        expect(passwordInput.props.editable).toBe(false);

        await act(async () => {
            resolveRegister!(mockResponse);
            await registerPromise;
        });

        await waitFor(() => {
            expect(emailInput.props.editable).toBe(true);
            expect(usernameInput.props.editable).toBe(true);
            expect(passwordInput.props.editable).toBe(true);
        });
    });

    it("shows error message when registration fails", async () => {
        const errorMessage = "Email or username is already in use";
        registerUserMock.mockRejectedValueOnce(new Error(errorMessage));

        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        expect(await findByText(errorMessage)).toBeTruthy();
        expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
    });

    it("handles registration failure with empty error message", async () => {
        registerUserMock.mockRejectedValueOnce(new Error(""));

        const { getByPlaceholderText, getByText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        await waitFor(() => {
            expect(registerUserMock).toHaveBeenCalled();
            expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
        });
    });

    it("shows generic error message when registration fails with non-Error object", async () => {
        registerUserMock.mockRejectedValueOnce("String error");

        const { getByPlaceholderText, getByText, findByText } =
            renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        const registerButton = getByText("Sign Up");
        await act(async () => {
            fireEvent.press(registerButton);
        });

        expect(
            await findByText("Registration failed. Please try again.")
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

        registerUserMock.mockResolvedValueOnce(mockResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);
        mockReplace.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText } = renderRegisterScreen();

        const emailInput = getByPlaceholderText("Enter your email");
        const usernameInput = getByPlaceholderText("Choose a username");
        const passwordInput = getByPlaceholderText("Enter your password");

        fireEvent.changeText(emailInput, "test@example.com");
        fireEvent.changeText(usernameInput, "testuser");
        fireEvent.changeText(passwordInput, "password123");

        await act(async () => {
            fireEvent(passwordInput, "submitEditing");
        });

        await waitFor(() => {
            expect(registerUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                username: "testuser",
                password: "password123",
            });
        });
    });

    it("navigates back when back button is pressed and can go back", () => {
        mockCanGoBack.mockReturnValue(true);

        const { getByText } = renderRegisterScreen();

        const backButton = getByText("← Back");
        fireEvent.press(backButton);

        expect(mockBack).toHaveBeenCalledTimes(1);
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it("navigates to settings when back button is pressed and cannot go back", () => {
        mockCanGoBack.mockReturnValue(false);

        const { getByText } = renderRegisterScreen();

        const backButton = getByText("← Back");
        fireEvent.press(backButton);

        expect(mockBack).not.toHaveBeenCalled();
        expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
    });

    it("navigates to login when Sign In link is pressed", () => {
        const { getByText } = renderRegisterScreen();

        const signInLink = getByText("Sign In");
        fireEvent.press(signInLink);

        expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it("displays Sign In link in footer", () => {
        const { getByText } = renderRegisterScreen();

        expect(getByText("Already have an account?")).toBeTruthy();
        expect(getByText("Sign In")).toBeTruthy();
    });
});

