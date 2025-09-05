// Serviço unificado para diferentes provedores de IA
export type AIProvider = 'openai' | 'gemini' | 'claude';

export interface AIProviderConfig {
  name: string;
  displayName: string;
  requiresApiKey: boolean;
  supportedModels: string[];
}

export const AI_PROVIDERS: Record<AIProvider, AIProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI (GPT)',
    requiresApiKey: true,
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-vision-preview']
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    requiresApiKey: true,
    supportedModels: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro-vision']
  },
  claude: {
    name: 'claude',
    displayName: 'Anthropic Claude',
    requiresApiKey: true,
    supportedModels: ['claude-3-sonnet-20240229', 'claude-3-haiku-20240307']
  }
};

export interface BillAnalysisResult {
  beneficiary: string;
  amount: number;
  dueDate: string;
  category: string;
  confidence: number;
  summary: string; // Resumo textual das informações extraídas
  barcode?: string; // Linha digitável (somente números)
}

// Função para analisar boleto usando diferentes provedores de IA
export const analyzeBillWithProvider = async (
  file: File, 
  apiKey: string, 
  provider: AIProvider = 'openai'
): Promise<BillAnalysisResult> => {
  if (!apiKey) {
    throw new Error('Chave da API não configurada');
  }

  // Suporta tanto imagens quanto PDFs
  const isPDF = file.type === 'application/pdf';
  if (!file.type.startsWith('image/') && !isPDF) {
    throw new Error('Apenas arquivos de imagem ou PDF são suportados para análise.');
  }

  console.log(`AI Provider: Iniciando análise com ${provider}:`, file.name, isPDF ? '(PDF)' : '(Imagem)');

  const base64 = await fileToBase64(file);

  switch (provider) {
    case 'openai':
      return await analyzeWithOpenAI(file, base64, apiKey, isPDF);
    case 'gemini':
      return await analyzeWithGemini(file, base64, apiKey, isPDF);
    case 'claude':
      return await analyzeWithClaude(file, base64, apiKey, isPDF);
    default:
      throw new Error(`Provedor ${provider} não suportado`);
  }
};

// Função para gerar prompt baseado no tipo de arquivo
const getAnalysisPrompt = (isPDF: boolean): string => {
  const fileType = isPDF ? 'PDF de um boleto bancário' : 'imagem de um boleto bancário';
  
  return `Leia este ${fileType} brasileiro e extraia as informações.

PRIMEIRO: Gere um resumo detalhado com as seguintes informações:
1. Favorecido/Beneficiário: [nome completo da empresa ou pessoa]
2. Valor (em reais): [valor total a ser pago]
3. Data de Vencimento: [data limite para pagamento no formato DD/MM/AAAA]
4. Categoria: [classifique em: Aluguel, Condomínio, Energia, Água, Gás, Internet, Mercado, Impostos, ou Outros]
5. Código de barras (linha digitável): [apenas números, sem espaços ou pontos - geralmente 44 a 48 dígitos]

SEGUNDO: Com base nesse resumo, retorne um objeto JSON válido:
{
  "beneficiary": "nome_completo_do_beneficiário",
  "amount": valor_numérico_sem_formatação,
  "dueDate": "YYYY-MM-DD",
  "category": "categoria_apropriada",
  "confidence": valor_entre_0_e_1,
  "summary": "resumo_textual_das_informações_extraídas",
  "barcode": "string_com_apenas_números_da_linha_digitável"
}

INSTRUÇÕES:
1. Para "amount": use apenas números (ex: 125.50)
2. Para "dueDate": sempre formato YYYY-MM-DD
3. Para "category": escolha da lista acima
4. Para "confidence": avalie a clareza do arquivo (0.0 a 1.0)
5. Para "summary": inclua o resumo detalhado das informações encontradas
6. Para "barcode": retorne somente os números da linha digitável, sem espaços, pontos ou hífens. Se não conseguir identificar com confiança, deixe vazio ou omita.

Retorne SOMENTE o objeto JSON final.`;
};

// Implementação para OpenAI
const analyzeWithOpenAI = async (file: File, base64: string, apiKey: string, isPDF: boolean = false): Promise<BillAnalysisResult> => {
  console.log('OpenAI: Enviando requisição...', isPDF ? '(PDF)' : '(Imagem)');
  
  const content = isPDF 
    ? [
        {
          type: 'text',
          text: getAnalysisPrompt(true)
        },
        {
          type: 'text', 
          text: `Dados do PDF em base64: ${base64}`
        }
      ]
    : [
        {
          type: 'text',
          text: getAnalysisPrompt(false)
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${file.type};base64,${base64}`
          }
        }
      ];
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: isPDF ? 'gpt-4o' : 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro da API OpenAI: ${errorData.error?.message || 'Erro desconhecido'}`);
  }

  const data = await response.json();
  return parseAIResponse(data.choices[0]?.message?.content);
};

// Implementação para Google Gemini
const analyzeWithGemini = async (file: File, base64: string, apiKey: string, isPDF: boolean = false): Promise<BillAnalysisResult> => {
  console.log('Gemini: Enviando requisição...', isPDF ? '(PDF)' : '(Imagem)');
  
  const parts = isPDF 
    ? [
        {
          text: getAnalysisPrompt(true)
        },
        {
          text: `Dados do PDF em base64: ${base64}`
        }
      ]
    : [
        {
          text: getAnalysisPrompt(false)
        },
        {
          inline_data: {
            mime_type: file.type,
            data: base64
          }
        }
      ];
  
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro da API Gemini: ${errorData.error?.message || 'Erro desconhecido'}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    throw new Error('Resposta vazia da API Gemini');
  }

  return parseAIResponse(content);
};

// Implementação para Claude (Anthropic)
const analyzeWithClaude = async (file: File, base64: string, apiKey: string, isPDF: boolean = false): Promise<BillAnalysisResult> => {
  console.log('Claude: Enviando requisição...', isPDF ? '(PDF)' : '(Imagem)');
  
  const content = isPDF 
    ? [
        {
          type: 'text',
          text: `${getAnalysisPrompt(true)}

Dados do PDF em base64: ${base64}`
        }
      ]
    : [
        {
          type: 'text',
          text: getAnalysisPrompt(false)
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: file.type,
            data: base64
          }
        }
      ];
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    })
  });

  if (!response.ok) {
    const errorData = await response.json(); 
    throw new Error(`Erro da API Claude: ${errorData.error?.message || 'Erro desconhecido'}`);
  }

  const data = await response.json();
  const content_text = data.content?.[0]?.text;
  
  if (!content_text) {
    throw new Error('Resposta vazia da API Claude');
  }

  return parseAIResponse(content_text);
};

// Função auxiliar para fazer parse da resposta da IA
const parseAIResponse = (content: string): BillAnalysisResult => {
  console.log('AI Response:', content);
  
  // Tentar extrair JSON da resposta
  let jsonMatch = content.match(/\{[\s\S]*\}/);
  
  if (!jsonMatch) {
    // Limpar possíveis caracteres extras
    const cleanContent = content.replace(/```json|```/g, '').trim();
    jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
  }
  
  if (!jsonMatch) {
    throw new Error(`A IA não conseguiu analisar o boleto. Resposta: ${content.substring(0, 200)}...`);
  }

  let result;
  try {
    result = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    throw new Error(`Erro ao interpretar resposta da IA: ${parseError instanceof Error ? parseError.message : 'Erro desconhecido'}`);
  }
  
  // Validar resultado
  if (!result.beneficiary || !result.amount || !result.dueDate) {
    throw new Error('Dados incompletos extraídos do boleto. Verifique se a imagem está legível.');
  }

  return {
    beneficiary: result.beneficiary,
    amount: parseFloat(result.amount),
    dueDate: result.dueDate,
    category: result.category || 'Outros',
    confidence: result.confidence || 0.8,
    summary: result.summary || `Beneficiário: ${result.beneficiary}, Valor: R$ ${result.amount}, Vencimento: ${result.dueDate}, Categoria: ${result.category || 'Outros'}`,
    barcode: result.barcode ? String(result.barcode).replace(/\D/g, '') : undefined,
  };
};

// Função auxiliar para converter arquivo para base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Função para obter configurações da IA do localStorage
export const getAISettings = (): { apiKey: string | null; provider: AIProvider } => {
  try {
    const settings = localStorage.getItem("finanscan-settings");
    if (settings) {
      const parsed = JSON.parse(settings);
      return {
        apiKey: parsed.aiApiKey || null,
        provider: parsed.aiProvider || 'openai'
      };
    }
  } catch (error) {
    console.error('Erro ao obter configurações da IA:', error);
  }
  return { apiKey: null, provider: 'openai' };
};