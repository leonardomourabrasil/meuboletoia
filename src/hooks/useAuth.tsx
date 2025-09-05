import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  // Added for password recovery
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  isPasswordRecovery: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const { toast } = useToast();

  // Centraliza URLs de redirecionamento via env com fallback
  const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
  const SIGNUP_REDIRECT_URL = import.meta.env.VITE_SIGNUP_REDIRECT || `${SITE_URL}/`;
  const PASSWORD_RESET_REDIRECT_URL = import.meta.env.VITE_PASSWORD_RESET_REDIRECT || `${SITE_URL}/auth`;

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        // Detect password recovery flow triggered from email link
        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
          toast({
            title: 'Redefinição de senha',
            description: 'Informe a nova senha para continuar.'
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [toast]);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = SIGNUP_REDIRECT_URL;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Cadastro realizado!",
          description: "Verifique seu email para confirmar a conta."
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Login realizado!",
          description: "Bem-vindo ao MeuBoletoAI"
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: "Erro no login",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  // Added: send reset password email
  const resetPassword = async (email: string) => {
    try {
      const redirectUrl = PASSWORD_RESET_REDIRECT_URL;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl
      });

      if (error) {
        toast({
          title: 'Erro ao enviar email de redefinição',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Email enviado',
          description: 'Verifique sua caixa de entrada para redefinir a senha.'
        });
      }

      return { error };
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar email de redefinição',
        description: error.message,
        variant: 'destructive'
      });
      return { error };
    }
  };

  // Added: update user password after recovery link
  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        toast({
          title: 'Erro ao atualizar senha',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Senha atualizada',
          description: 'Sua senha foi redefinida com sucesso.'
        });
        setIsPasswordRecovery(false);
      }

      return { error };
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar senha',
        description: error.message,
        variant: 'destructive'
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso"
      });
    } catch (error: any) {
      toast({
        title: "Erro no logout",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut,
      resetPassword,
      updatePassword,
      isPasswordRecovery
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};