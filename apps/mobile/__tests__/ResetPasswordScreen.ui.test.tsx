import React from "react";
import {
    act,
    cleanup,
    fireEvent,
    render,
    waitFor,
} from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ResetPasswordScreen from "../app/reset-password";
import { loginUser, resetPasswordForLoggedInUser } from "../lib/auth";
import { useAuthStore } from "../lib/store/auth";

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);

jest.mock("expo-router", () => ({
    useRouter: () => ({
        push: mockPush,
        replace: mockReplace,
        back: mockBack,
        canGoBack: mockCanGoBack,
    }),
}));

jest.mock("../lib/auth", () => ({
    loginUser: jest.fn(),
    resetPasswordForLoggedInUser: jest.fn(),
}));

jest.mock("../lib/store/auth", () => {
    const actual = jest.requireActual("../lib/store/auth");
    return {
        ...actual,
        useAuthStore: jest.fn(),
    };
});

const loginUserMock = loginUser as jest.MockedFunction<typeof loginUser>;
const resetPasswordForLoggedInUserMock =
    resetPasswordForLoggedInUser as jest.MockedFunction<
        typeof resetPasswordForLoggedInUser
    >;
const useAuthStoreMock = useAuthStore as jest.MockedFunction<
    typeof useAuthStore
>;

const mockUser = {
    id: "user-1",
    email: "test@example.com",
    username: "testuser",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
};

const mockSetAuthFromResponse = jest.fn();

function renderResetPasswordScreen() {
    return render(
        <SafeAreaProvider
            initialMetrics={{
                frame: { x: 0, y: 0, width: 390, height: 844 },
                insets: { top: 0, right: 0, bottom: 0, left: 0 },
            }}
        >
            <ResetPasswordScreen />
        </SafeAreaProvider>
    );
}

beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockReset();
    mockReplace.mockReset();
    mockBack.mockReset();
    mockCanGoBack.mockReturnValue(true);
    useAuthStoreMock.mockImplementation((selector: any) => {
        const mockState = {
            user: mockUser,
            setAuthFromResponse: mockSetAuthFromResponse,
        };
        return selector(mockState);
    });
});

afterEach(() => {
    cleanup();
});

describe("ResetPasswordScreen UI", () => {
    it("renders reset password form with password inputs", () => {
        const { getByPlaceholderText, getAllByText, getByText } =
            renderResetPasswordScreen();

        expect(getByPlaceholderText("Enter your new password")).toBeTruthy();
        expect(
            getByPlaceholderText("Confirm your new password")
        ).toBeTruthy();
        expect(getAllByText("Reset Password").length).toBeGreaterThan(0);
        expect(getByText("Enter your new password below")).toBeTruthy();
    });

    it("updates password input when user types", () => {
        const { getByPlaceholderText } = renderResetPasswordScreen();
        const passwordInput = getByPlaceholderText("Enter your new password");

        fireEvent.changeText(passwordInput, "newPassword123");

        expect(passwordInput.props.value).toBe("newPassword123");
    });

    it("updates confirm password input when user types", () => {
        const { getByPlaceholderText } = renderResetPasswordScreen();
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        expect(confirmPasswordInput.props.value).toBe("newPassword123");
    });

    it("clears error when user starts typing in password field", async () => {
        const { getByPlaceholderText, queryByText, getAllByText } =
            renderResetPasswordScreen();
        const passwordInput = getByPlaceholderText("Enter your new password");
        const resetButton = getAllByText("Reset Password")[1];

        fireEvent.press(resetButton);

        await waitFor(() => {
            expect(queryByText(/Please enter both password fields/)).toBeTruthy();
        });

        fireEvent.changeText(passwordInput, "newPassword123");

        await waitFor(() => {
            expect(queryByText(/Please enter both password fields/)).toBeNull();
        });
    });

    it("clears error when user starts typing in confirm password field", async () => {
        const { getByPlaceholderText, queryByText, getAllByText } =
            renderResetPasswordScreen();
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );
        const resetButton = getAllByText("Reset Password")[1];

        fireEvent.press(resetButton);

        await waitFor(() => {
            expect(queryByText(/Please enter both password fields/)).toBeTruthy();
        });

        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        await waitFor(() => {
            expect(queryByText(/Please enter both password fields/)).toBeNull();
        });
    });

    it("shows error when reset button is pressed with empty fields", async () => {
        const { getAllByText, findByText } = renderResetPasswordScreen();

        const resetButton = getAllByText("Reset Password")[1];
        fireEvent.press(resetButton);

        expect(
            await findByText("Please enter both password fields")
        ).toBeTruthy();
        expect(resetPasswordForLoggedInUserMock).not.toHaveBeenCalled();
    });

    it("shows error when password is less than 8 characters", async () => {
        const { getByPlaceholderText, getAllByText, findByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "short");
        fireEvent.changeText(confirmPasswordInput, "short");

        const resetButton = getAllByText("Reset Password")[1];
        fireEvent.press(resetButton);

        expect(
            await findByText("Password must be at least 8 characters long")
        ).toBeTruthy();
        expect(resetPasswordForLoggedInUserMock).not.toHaveBeenCalled();
    });

    it("shows error when passwords do not match", async () => {
        const { getByPlaceholderText, getAllByText, findByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "password123");
        fireEvent.changeText(confirmPasswordInput, "password456");

        const resetButton = getAllByText("Reset Password")[1];
        fireEvent.press(resetButton);

        expect(await findByText("Passwords do not match")).toBeTruthy();
        expect(resetPasswordForLoggedInUserMock).not.toHaveBeenCalled();
    });

    it("calls resetPasswordForLoggedInUser and loginUser on successful reset", async () => {
        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getAllByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        await waitFor(() => {
            expect(resetPasswordForLoggedInUserMock).toHaveBeenCalledWith(
                "newPassword123"
            );
            expect(loginUserMock).toHaveBeenCalledWith({
                email: "test@example.com",
                password: "newPassword123",
            });
            expect(mockSetAuthFromResponse).toHaveBeenCalledWith(loginResponse);
        });
    });

    it("shows loading state during password reset", async () => {
        let resolveReset: (value: typeof resetResponse) => void;
        const resetPromise = new Promise<typeof resetResponse>((resolve) => {
            resolveReset = resolve;
        });

        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockImplementationOnce(
            () => resetPromise
        );
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const screen = renderResetPasswordScreen();
        const { getByPlaceholderText, getAllByText, getByTestId } = screen;

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        expect(getByTestId("reset-password-loading")).toBeTruthy();

        await act(async () => {
            resolveReset!(resetResponse);
            await resetPromise;
        });

        await waitFor(() => {
            expect(() => screen.getByTestId("reset-password-loading")).toThrow();
        });
    });

    it("disables inputs during password reset", async () => {
        let resolveReset: (value: typeof resetResponse) => void;
        const resetPromise = new Promise<typeof resetResponse>((resolve) => {
            resolveReset = resolve;
        });

        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockImplementationOnce(
            () => resetPromise
        );
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const screen = renderResetPasswordScreen();
        const { getByPlaceholderText, getAllByText } = screen;

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        expect(passwordInput.props.editable).toBe(false);
        expect(confirmPasswordInput.props.editable).toBe(false);

        await act(async () => {
            resolveReset!(resetResponse);
            await resetPromise;
        });

        await waitFor(
            () => {
                try {
                    const updatedPasswordInput = screen.getByPlaceholderText(
                        "Enter your new password"
                    );
                    const updatedConfirmPasswordInput =
                        screen.getByPlaceholderText(
                            "Confirm your new password"
                        );
                    expect(updatedPasswordInput.props.editable).toBe(true);
                    expect(updatedConfirmPasswordInput.props.editable).toBe(
                        true
                    );
                } catch {
                    const successScreen = screen.getByText(
                        "Password Reset Successful"
                    );
                    expect(successScreen).toBeTruthy();
                }
            },
            { timeout: 2000 }
        );
    });

    it("shows error message when password reset fails", async () => {
        const errorMessage = "Failed to generate reset token";
        resetPasswordForLoggedInUserMock.mockRejectedValueOnce(
            new Error(errorMessage)
        );

        const { getByPlaceholderText, getAllByText, findByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        expect(await findByText(errorMessage)).toBeTruthy();
        expect(loginUserMock).not.toHaveBeenCalled();
        expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
    });

    it("shows error message when login after reset fails", async () => {
        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockRejectedValueOnce(new Error("Login failed"));

        const { getByPlaceholderText, getAllByText, findByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        const errorText = await findByText("Login failed");
        expect(errorText).toBeTruthy();
        expect(mockSetAuthFromResponse).not.toHaveBeenCalled();
    });

    it("shows success screen after successful password reset", async () => {
        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getAllByText, findByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        await waitFor(async () => {
            expect(await findByText("Password Reset Successful")).toBeTruthy();
        });
        expect(
            await findByText(
                "Your password has been reset successfully. Redirecting to settings..."
            )
        ).toBeTruthy();
    });

    it("navigates back when back button is pressed", () => {
        const { getByText } = renderResetPasswordScreen();

        const backButton = getByText("← Back");
        fireEvent.press(backButton);

        expect(mockBack).toHaveBeenCalled();
    });

    it("navigates to settings when back button is pressed and cannot go back", () => {
        mockCanGoBack.mockReturnValue(false);

        const { getByText } = renderResetPasswordScreen();

        const backButton = getByText("← Back");
        fireEvent.press(backButton);

        expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
    });

    it("submits form when password input is submitted", async () => {
        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText } = renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        await act(async () => {
            fireEvent(passwordInput, "submitEditing");
        });

        await waitFor(() => {
            expect(resetPasswordForLoggedInUserMock).toHaveBeenCalledWith(
                "newPassword123"
            );
        });
    });

    it("submits form when confirm password input is submitted", async () => {
        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText } = renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        await act(async () => {
            fireEvent(confirmPasswordInput, "submitEditing");
        });

        await waitFor(() => {
            expect(resetPasswordForLoggedInUserMock).toHaveBeenCalledWith(
                "newPassword123"
            );
        });
    });

    it("redirects to settings after successful reset", async () => {
        jest.useFakeTimers();

        const resetResponse = {
            success: true,
            message: "Password has been reset successfully",
        };

        const loginResponse = {
            user: mockUser,
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
        };

        resetPasswordForLoggedInUserMock.mockResolvedValueOnce(resetResponse);
        loginUserMock.mockResolvedValueOnce(loginResponse);
        mockSetAuthFromResponse.mockResolvedValueOnce(undefined);

        const { getByPlaceholderText, getAllByText } =
            renderResetPasswordScreen();

        const passwordInput = getByPlaceholderText("Enter your new password");
        const confirmPasswordInput = getByPlaceholderText(
            "Confirm your new password"
        );

        fireEvent.changeText(passwordInput, "newPassword123");
        fireEvent.changeText(confirmPasswordInput, "newPassword123");

        const resetButton = getAllByText("Reset Password")[1];
        await act(async () => {
            fireEvent.press(resetButton);
        });

        await waitFor(() => {
            expect(mockSetAuthFromResponse).toHaveBeenCalled();
        });

        act(() => {
            jest.advanceTimersByTime(1500);
        });

        await waitFor(() => {
            expect(mockReplace).toHaveBeenCalledWith("/(tabs)/settings");
        });

        jest.useRealTimers();
    });
});

