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

### 5. Experimentos

- Validar segurança dos reagentes/materiais para ambiente com público leigo (crianças, visitantes não técnicos)
- Definir tempo de execução de cada experimento (precisa ser compatível com o fluxo do estande — visitantes não podem esperar muito)
- Preparar quantidade de material suficiente para repetições ao longo do dia do evento
- Testar o experimento fisicamente na RASPILUM antes do evento (dry run completo)
- Ideias de experimentos:

> #### Reação 1: Garrafa azul
>
> Efeito esperado: Solução incolor, mas fica azul quando agitada. O experimento é esperado demorar 1/2 min para reverter.
>
> Materiais:
>
> 2x Erlenmeyer/garrafa com tampa de 200/250 ml
> 5,4 g de KOH
> 6,6 g de glicose
> 4 gotas de azul de metileno
> 200 ml de agua deionizada
>
> Validade: Preparar um ou dois dias antes (se possível, no dia, como caso ideal) para garantir a velocidade e intensidade da reação
>
> Preparação:
> Colocar 100 ml de agua no recipiente
> Adicionar 2,7 g de KOH, mexer até dissolver
> Após a solução esfriar, adicionar 3,3 g de glicose, mexer até dissolver
> Adicionar 2 gotas de azul de metileno
> Tampar e deixar em repouso até ficar incolor
>
> Preparar duas soluções
>
> Proteção:
> Óculos, jaleco e luvas para preparar (KOH é caustico)
> Se for deixar armazenado por muito tempo, não usar recipiente de vidro
>
> Fonte: [The ‘blue bottle’ experiment](https://edu.rsc.org/experiments/the-blue-bottle-experiment/729.article?)

> #### Reação 2: Solução semáforo
>
> Efeito esperado: Solução amarela, fica verde e depois vermelha ao agitar
>
> Materiais:
>
> 3x Bequer
> 2x Erlenmeyer/garrafa com tampa de 200/250 ml
> 2,24 g de NaOH
> 5 g de glicose
> 40 mg de Indigo Carmin
> 200 ml de agua deionizada
>
> Validade: dura 60-75 min após o preparo. Depois disso, suas mudanças de cor se tornam menos impressionantes. Preparar 20/30 min antes de iniciar o evento
>
> Preparação:
> No recipiente A, dissolva 1,12 g de NaOH em 50 ml de agua
> Após resfriar, complete até 70 ml de agua
> No recipiente B, dissolva 2,5 g de glicose em 10 ml de agua
> No recipiente C, dissolva 20 mg do Indigo Carmin em 20 ml de agua
> Misture os três no mesmo recipiente
>
> Preparar duas soluções, mas somente na hora
>
> Proteção:
> Óculos, jaleco e luvas para preparar (NaOH é caustico)
> Se for deixar armazenado por muito tempo, não usar recipiente de vidro
>
> Fonte: [Beyond the ‘blue bottle’](https://edu.rsc.org/exhibition-chemistry/beyond-the-blue-bottle/2000041.article?)

> #### Reação 3: Equilíbrio com Cobalto
>
> Reação 3: Solução CoCl2
> Efeito esperado: Solução azul, apos o aquecimento se torna rosa
>
> Materiais:
>
> 2x Erlenmeyer/garrafa com tampa de 200/250 ml
> 9,52 g de CoCL2 . 6H2O
> 200 ml de agua deionizada
>
> Validade: até 3 meses
>
> Preparação:
> Dissolver 4,76 g de CoCl2 . 6H2O em 50 ml de água
> Completar o volume e tampar o recipiente
>
> Preparar duas soluções
>
> Proteção:
> Óculos, jaleco, luvas e máscara para o material particulado
>
> Fonte: Atividade 1 de Práticas Básicas de Laboratório - Valéria Spolon

### 6. Estande / Logística

- Definir infraestrutura necessária (energia, internet, espaço físico para a RASPILUM)
- Preparar material de apoio visual (banner, explicação do projeto para quem passar e não interagir)
- Definir escala da equipe durante o evento (quem opera, quem explica, quem dá suporte técnico)
- Ensaiar a demonstração completa com a equipe antes do dia do evento
- Plano B para falhas técnicas (roteiro alternativo sem depender 100% do sistema funcionando)

#### Plano B:

- Vídeos demonstrativos do sistema funcionando
- Interação com o J.A.I.M.E. mesmo sem a RASPILUM
- Explicação interativa dos experimentos e análise dos dados

## Integrantes

- Filipi Martins **(Aluno Responsável)**
- Gabriel de Oliveira Paiva
- Gustavo Junqueira Colas
- Matheus Luiz Mendes de Souza
- Pedro Lucas Miranda da Silva de Sá
- Vinícius Marianno de Marque Cutolo

## Professor Orientador

- Professor Doutor Leandro das Mercês Silva
