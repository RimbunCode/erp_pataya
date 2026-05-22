<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Authentication Language Lines
    |--------------------------------------------------------------------------
    |
    | The following language lines are used during authentication for various
    | messages that we need to display to the user. You are free to modify
    | these language lines according to your application's requirements.
    |
    */

    'failed'         => 'These credentials do not match our records.',
    'disabled'       => 'Your account has been disabled!',
    'no_role_access' => 'Your account does not have an active role. Please contact an administrator.',
    'invalid_role'   => 'The selected role is invalid for this account.',
    'password'       => 'The provided password is incorrect.',
    'throttle'       => 'Too many login attempts. Please try again in :seconds seconds.',
    'your_password'  => 'Your Password',
    'login'          => [
        'title'           => 'Welcome Back',
        'description'     => 'Login with your credential or Google account',
        'usernameOrEmail' => 'Username or Email',
        'password'        => 'Password',
        'remember'        => 'Remember Me',
        'forgotPassword'  => 'Forgot Your Password?',
        'button'          => 'Login',
        'or'              => 'Or continue with',
        'google'          => 'Login with Google',
        'register'        => 'Don\'t have an account?',
        'registerLink'    => 'Register Now',
    ],
    'register' => [
        'title'              => 'Register',
        'description'        => 'Register with your credential or Google account',
        'name'               => 'Name',
        'username'           => 'Username',
        'email'              => 'Email',
        'password'           => 'Password',
        'password.strengths' => [
            'status' => [
                'weak'   => 'Weak Security',
                'medium' => 'Medium Security',
                'good'   => 'Good Security',
                'strong' => 'Strong Security',
            ],
            'requirements' => [
                'length'    => 'At least 8 characters (Required)',
                'lowercase' => 'At least 1 lowercase letter',
                'uppercase' => 'At least 1 uppercase letter',
                'num'       => 'At least 1 number',
                'special'   => 'At least 1 special character',
            ],
        ],
        'confirm_password' => 'Confirm Password',
        'button'           => 'Register',
        'or'               => 'Or continue with',
        'google'           => 'Register with Google',
        'login'            => 'Already have an account?',
        'loginLink'        => 'Login Now',
    ],
    'forgotPassword' => [
        'description' => 'Forgot your password? No problem. Just let us know your email address and we will email you a password reset link that will allow you to choose a new one.',
        'button'      => 'Send Password Reset Link',
    ],
    'setupUser' => [
        'title'               => 'Setup Your Account',
        'description'         => 'Please fill in the form below to setup your account',
        'waiting.title'       => 'Contact Your Admin for Approval',
        'waiting.description' => 'Please contact your admin to approve your account.',
        'credential'          => 'Credential',
        'profile'             => 'Profile',
        'button'              => [
            'save'   => 'Save',
            'setup'  => 'Setup',
            'logout' => 'Logout',
        ],
    ],
];
