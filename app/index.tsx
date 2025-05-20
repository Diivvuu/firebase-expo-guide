import {
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import React, { useState } from 'react';
import { auth, db } from '../FirebaseConfig';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { MotiView } from 'moti';

interface UserDetails {
  email: string;
  password: string;
  name: string;
  bio: string;
  phoneNumber: string;
}

interface ValidationErrors {
  email?: string;
  password?: string;
  name?: string;
  phoneNumber?: string;
}

const LoginScreen = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails>({
    email: '',
    password: '',
    name: '',
    bio: '',
    phoneNumber: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone) return true; // Optional field
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s+/g, ''));
  };

  const validatePassword = (password: string): boolean => {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return passwordRegex.test(password);
  };

  const validateInputs = (): boolean => {
    const newErrors: ValidationErrors = {};

    // Email validation
    if (!userDetails.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(userDetails.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!userDetails.password) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(userDetails.password)) {
      newErrors.password =
        'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character';
    }

    // Name validation (for sign up)
    if (isSignUp) {
      if (!userDetails.name.trim()) {
        newErrors.name = 'Name is required';
      } else if (userDetails.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters long';
      }
    }

    // Phone number validation (for sign up)
    if (isSignUp && userDetails.phoneNumber) {
      if (!validatePhoneNumber(userDetails.phoneNumber)) {
        newErrors.phoneNumber = 'Please enter a valid phone number';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const signIn = async () => {
    if (!validateInputs()) return;
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        userDetails.email,
        userDetails.password
      );
      if (userCredential.user) {
        await setDoc(
          doc(db, 'users', userCredential.user.uid),
          {
            lastSeen: serverTimestamp(),
          },
          { merge: true }
        );
        router.replace('/(tabs)/users');
      }
    } catch (error: any) {
      console.log('Sign in error:', error);
      if (error.code === 'auth/user-not-found') {
        setErrors({ email: 'No account found with this email' });
      } else if (error.code === 'auth/wrong-password') {
        setErrors({ password: 'Incorrect password' });
      } else {
        setErrors({ email: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async () => {
    if (!validateInputs()) return;
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        userDetails.email,
        userDetails.password
      );
      if (userCredential.user) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userDetails.email,
          name: userDetails.name.trim(),
          bio: userDetails.bio.trim(),
          phoneNumber: userDetails.phoneNumber.trim(),
          createdAt: serverTimestamp(),
          lastSeen: serverTimestamp(),
        });
        router.replace('/(tabs)/users');
      }
    } catch (error: any) {
      console.log('Sign up error:', error);
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'An account already exists with this email' });
      } else {
        setErrors({ email: error.message });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderInput = (
    icon: string,
    placeholder: string,
    value: string,
    onChangeText: (text: string) => void,
    secureTextEntry?: boolean,
    keyboardType: 'default' | 'email-address' | 'phone-pad' = 'default',
    error?: string
  ) => (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
    >
      <View style={[styles.inputContainer, error ? styles.inputError : null]}>
        <Ionicons
          name={icon as any}
          size={20}
          color={error ? '#FF3B30' : '#666'}
          style={styles.inputIcon}
        />
        <TextInput
          style={[styles.textInput, error ? styles.textInputError : null]}
          placeholder={placeholder}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize="none"
          editable={!isLoading}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.eyeIcon}
            onPress={() => setShowPassword(!showPassword)}
            disabled={isLoading}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={error ? '#FF3B30' : '#666'}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </MotiView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.contentContainer}>
            <Text style={styles.title}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp ? 'Sign up to get started' : 'Sign in to continue'}
            </Text>

            {renderInput(
              'mail-outline',
              'Email',
              userDetails.email,
              (text) => {
                setUserDetails({ ...userDetails, email: text });
                setErrors({ ...errors, email: undefined });
              },
              false,
              'email-address',
              errors.email
            )}

            {renderInput(
              'lock-closed-outline',
              'Password',
              userDetails.password,
              (text) => {
                setUserDetails({ ...userDetails, password: text });
                setErrors({ ...errors, password: undefined });
              },
              true,
              'default',
              errors.password
            )}

            {isSignUp && (
              <>
                {renderInput(
                  'person-outline',
                  'Full Name',
                  userDetails.name,
                  (text) => {
                    setUserDetails({ ...userDetails, name: text });
                    setErrors({ ...errors, name: undefined });
                  },
                  false,
                  'default',
                  errors.name
                )}

                {renderInput(
                  'call-outline',
                  'Phone Number (optional)',
                  userDetails.phoneNumber,
                  (text) => {
                    setUserDetails({ ...userDetails, phoneNumber: text });
                    setErrors({ ...errors, phoneNumber: undefined });
                  },
                  false,
                  'phone-pad',
                  errors.phoneNumber
                )}

                {renderInput(
                  'information-circle-outline',
                  'Bio (optional)',
                  userDetails.bio,
                  (text) => setUserDetails({ ...userDetails, bio: text })
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={isSignUp ? signUp : signIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => {
                setIsSignUp(!isSignUp);
                setErrors({});
              }}
              disabled={isLoading}
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                {isSignUp
                  ? 'Already have an account? Sign In'
                  : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A237E',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  eyeIcon: {
    padding: 8,
  },
  button: {
    backgroundColor: '#1A237E',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#1A237E',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#1A237E',
  },
  inputError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
  },
  textInputError: {
    color: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 16,
  },
});
