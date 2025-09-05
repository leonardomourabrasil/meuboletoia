import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  fullName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
});

// Added: schemas for password recovery
const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

const newPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
    confirmPassword: z.string().min(6, 'Confirme a senha com pelo menos 6 caracteres'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type LoginFormData = z.infer<typeof loginSchema>;
type SignupFormData = z.infer<typeof signupSchema>;
// Added: types for recovery
type ForgotFormData = z.infer<typeof forgotSchema>;
type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false); // Added
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const { signIn, signUp, user, resetPassword, updatePassword, isPasswordRecovery } = useAuth(); // Added
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: '',
      password: '',
      fullName: '',
    },
  });

  // Added: forgot and new password forms
  const forgotForm = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: '' },
  });

  const newPasswordForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (user && !isPasswordRecovery) {
      navigate('/');
    }
  }, [user, navigate, isPasswordRecovery]);

  const onLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    if (!error) {
      navigate('/');
    }
    setIsLoading(false);
  };

  const onSignup = async (data: SignupFormData) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, data.fullName);
    if (!error) {
      // Stay on auth page to show success message
    }
    setIsLoading(false);
  };

  // Added: send reset email
  const onForgot = async (data: ForgotFormData) => {
    setIsLoading(true);
    const { error } = await resetPassword(data.email);
    if (!error) {
      setForgotMode(false);
    }
    setIsLoading(false);
  };

  // Added: update password after recovery
  const onUpdatePassword = async (data: NewPasswordFormData) => {
    setIsLoading(true);
    const { error } = await updatePassword(data.newPassword);
    if (!error) {
      navigate('/');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-primary">MeuBoletoAI</CardTitle>
          <CardDescription>
            Gerencie seus boletos com inteligência artificial
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* If the user is in recovery mode from email link, show new password form */}
          {isPasswordRecovery ? (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Redefinir senha</h3>
              <Form key={`recovery-${isPasswordRecovery}`} {...newPasswordForm}>
                <form onSubmit={newPasswordForm.handleSubmit(onUpdatePassword)} className="space-y-4">
                  <FormField
                    control={newPasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nova senha</FormLabel>
                        <FormControl>
                          <Input autoFocus type="password" placeholder="Mínimo 6 caracteres" autoComplete="new-password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={newPasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar nova senha</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="Repita a nova senha" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Atualizar senha'}
                  </Button>
                </form>
              </Form>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as 'login' | 'signup'); setForgotMode(false); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Cadastrar</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                {!forgotMode ? (
                  <Form key={`login-${forgotMode}`} {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                      <FormField
                        control={loginForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="seu@email.com" 
                                type="email" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={loginForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Senha</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Sua senha" 
                                type="password" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={isLoading}
                      >
                        {isLoading ? 'Entrando...' : 'Entrar'}
                      </Button>

                      <div className="text-center">
                        <Button type="button" variant="link" onClick={() => setForgotMode(true)}>
                          Esqueci minha senha
                        </Button>
                      </div>
                    </form>
                  </Form>
                ) : (
                  <Form key={`forgot-${forgotMode}`} {...forgotForm}>
                    <form onSubmit={forgotForm.handleSubmit(onForgot)} className="space-y-4">
                      <FormField
                        control={forgotForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input autoFocus placeholder="Digite seu email" type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Enviando...' : 'Enviar email de redefinição'}
                      </Button>
                      <div className="text-center">
                        <Button type="button" variant="link" onClick={() => setForgotMode(false)}>
                          Voltar para login
                        </Button>
                      </div>
                    </form>
                  </Form>
                )}
              </TabsContent>
              
              <TabsContent value="signup" className="space-y-4">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Seu nome completo" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="seu@email.com" 
                              type="email" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Mínimo 6 caracteres" 
                              type="password" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading}
                    >
                      {isLoading ? 'Cadastrando...' : 'Criar Conta'}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;