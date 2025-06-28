# Genuine Reasoning or Clever Mimicry? Evidence for Algorithmic Strategies in Language Models

Reasoning models like OpenAI's O1 and DeepSeek's R1 can generate detailed chain-of-thought traces that appear strikingly human-like. But are these models actually reasoning, or just producing plausible-sounding justifications? 

In this post, I investigate this question by training a language model on the Countdown arithmetic game and diving deep into its internal computations. Using mechanistic interpretability techniques, I uncover a surprising finding: the model learns a genuine algorithmic strategy, consistently starting with the largest number—a statistically optimal approach that emerges from training data patterns.

By analyzing the model's residual stream and attention mechanisms, I trace this behavior to a specific "sorting" attention head that prioritizes numbers by magnitude. This provides concrete evidence that reasoning traces can reflect genuine algorithmic computation rather than mere mimicry, offering new insights into the nature of reasoning in large language models.

*Keywords: mechanistic interpretability, reasoning models, GRPO, chain-of-thought, transformer attention* 