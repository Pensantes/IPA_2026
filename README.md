<!-- @format -->

<img src="./assets/header.png"/>

<h1 align="center">
Laboratório do Futuro
</h1>

<p align="center">
  <i>Estande para o Ilum de Portas Abertas (IPA)</i><br/>
  Ilum - Escola de Ciência | Campinas, 2026
</p>

## Objetivo

Apresentar, de forma prática e interativa, como tecnologias de **Inteligência Artificial** e **automação** podem transformar ambientes laboratoriais — mostrando ao público do IPA uma visão concreta do que pode ser o "laboratório do futuro".

## Conceito da demonstração

O assistente virtual **J.A.I.M.E** (Just An Intelligent Modular Entity) atua como interface entre o público e a **RASPILUM** (automatizadora de experimentos). O visitante interage por voz com o J.A.I.M.E, que interpreta o pedido, aciona a RASPILUM para executar o experimento, e responde/narra o que está acontecendo, unindo IA conversacional, automação física e comunicação em tempo real.

## Arquitetura do fluxo

1. Visitante ou apresentador fala com o J.A.I.M.E
2. STT converte a fala em texto
3. Interpretação/LLM entende o pedido e decide a ação
4. Comando RASPILUM é enviado e o experimento é executado
5. Resposta do J.A.I.M.E é gerada com base no resultado
6. TTS converte a resposta em fala
7. Visitante ouve a resposta

## Planejamento

### 1. Módulo STT (Speech-to-Text)

- Definir qual modelo/serviço de STT usar (considerar latência, custo e dependência de internet no estande)
- Testar captação de áudio em ambiente ruidoso (estande com público, conversas ao redor)
- Definir hardware de captura (microfone, distância ideal do usuário)

### 2. Interpretação do texto

- Definir personalidade e regras de comportamento do J.A.I.M.E (system prompt)
- Mapear quais comandos/intenções o sistema precisa reconhecer (ex: "iniciar experimento X", "qual o status?", "o que é a RASPILUM?")
- Definir separação entre perguntas gerais (sobre a faculdade/projeto) e comandos operacionais (para a RASPILUM)
- Tratar casos de ambiguidade ou comando não reconhecido (resposta de fallback, com humor)
- Definir limites de segurança (o que o J.A.I.M.E nunca deve executar sem confirmação)

### 3. Ligação com a RASPILUM

- Mapear a API/protocolo de comunicação com a RASPILUM (como enviar comandos, como receber status)
- Definir os comandos que a RASPILUM aceita (start, stop, status, parâmetros do experimento)
- Simular execução completa ponta a ponta (comando de voz → ação física → retorno)
- Plano de contingência caso a RASPILUM falhe durante o evento (modo manual/demo gravada)

### 4. Módulo TTS (Text-to-Speech)

- Escolher voz/modelo de TTS
- Testar clareza em ambiente com ruído de fundo (volume, caixa de som adequada para estande)
- Ajustar entonação/tempo de resposta para soar natural com a personalidade definida
- Testar latência total do ciclo (fala → STT → interpretação → RASPILUM → TTS) — meta de tempo de resposta aceitável para não perder o público

### 5. Experimentos (a definir)

- Decidir experimento(s) final(is) a serem demonstrados
  - Opção em consideração: **solução "semáforo"** (reação com mudança de cor visível — boa didática e visualmente chamativa)
  - Outras opções: Vamos verificar com a professora Valéria
- Validar segurança dos reagentes/materiais para ambiente com público leigo (crianças, visitantes não técnicos)
- Definir tempo de execução de cada experimento (precisa ser compatível com o fluxo do estande — visitantes não podem esperar muito)
- Preparar quantidade de material suficiente para repetições ao longo do dia do evento
- Testar o experimento fisicamente na RASPILUM antes do evento (dry run completo)

### 6. Estande / Logística

- Definir infraestrutura necessária (energia, internet, espaço físico para a RASPILUM)
- Preparar material de apoio visual (banner, explicação do projeto para quem passar e não interagir)
- Definir escala da equipe durante o evento (quem opera, quem explica, quem dá suporte técnico)
- Ensaiar a demonstração completa com a equipe antes do dia do evento
- Plano B para falhas técnicas (roteiro alternativo sem depender 100% do sistema funcionando)

## Integrantes

- Filipi Martins
- Gabriel de Oliveira Paiva
- Gustavo Junqueira Colas
- Matheus Luiz Mendes de Souza
- Pedro Lucas Miranda da Silva de Sá
- Vinícius Marianno de Marque Cutolo

## Professor Orientador

- Professor Doutor Leandro das Mercês Silva
