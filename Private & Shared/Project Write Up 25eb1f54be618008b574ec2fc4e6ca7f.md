# Project Write Up

## Intro

A key limitation of high performing LLMs is their ability to express uncertainty in their outputs. This creates serious problems in high stakes scenarios like medicine or law, where the risks of false positives can be extremely high. Confidence estimation is crucial for safe deployment: in these critical contexts, what we need is a model that knows when not to trust itself.

I recently read the paper: [*Beyond Binary Rewards*](https://www.arxiv.org/pdf/2507.16806) by Damani et al. They proposed a reinforcement learning scheme that leverages the typical RLVR framework used to train high performing reasoning models to also output an answer confidence score and associated analysis explaining that score.

One of the topics that drew me to mechanistic interpretability was understanding the internal reasoning processes of LLMs, how they arrive at decisions and whether their explanations are faithful. When reading *Beyond Binary Rewards*, it struck me that these new confidence outputs deserve the same level of scrutiny. When the model tells us "I am 70% sure of this answer," what exactly is that number grounded in? Is it derived from the logical structure of the solution, or something else entirely?

This project is a first attempt at exploring that question.

## Goal

My overarching goal was to get a clearer sense of how the reinforcement learning trained, calibrated reasoning model produced in *Beyond Binary Rewards*, they dub the RLCR model,  internally determines its confidence score and corresponding analysis of its uncertainty. Specifically, I wanted to know:

Does the model behave like a human expert, focusing primarily on the logical consistency of the solution? Or is it sensitive to other cues that might not matter to a human at all, things like minor spelling mistakes, grammatical noise, or other surface features of the text? In other words, when the confidence value drops, is that because the reasoning itself is shaky, or because the trace “looks” unusual?

Answering these questions felt important not only for interpretability, but also for calibration. If the confidence signal is being driven by shallow cues rather than deep reasoning, that would place real limits on how much we can trust it.

## Background and Dataset Choice

The *Beyond Binary Rewards* paper trained reasoning with confidence models using the typical cold start start SFT + RLVR scheme popularised by Deepseek. The deviation is that the primary reward mechanism optimized over in the RL stage is a reward function that augments a binary correctness score with a Brier score.

- What is a Brier Score?
    
    The Brier score measures the accuracy of probabilistic predictions by taking the mean squared difference between predicted probabilities and actual outcomes. Lower scores are better (0 is perfect), and it penalizes both overconfident wrong predictions and underconfident correct ones
    

The binary correctness score encourages the model to produce correct answer while the  Brier component encourages the model to avoid extreme miscalibration by penalizing overconfident errors much more heavily than moderate ones.

Formally, given a predictor that produces an output $y$, a confidence $q$, and ground truth output $y^*$

$R_{\text{RLCR}}(y, q, y^*) 
= R_{\text{correctness}}(y, y^*) + R_{\text{Brier}}(y, q, y^*)
= \mathbb{1}_{y \equiv y^*} - \left(q - \mathbb{1}_{y \equiv y^*}\right)^2$

Damani et al show impressive results: RLCR significantly enhances calibration across various datasets, both in domain and out of domain, without sacrificing accuracy. They used a Qwen2.5-7B-base as their base model and trained on a modified Big-Math and HotpotQA dataset. 

For the dataset, I focused exclusively on their math reasoning benchmark, [Big-Math Digits](https://huggingface.co/datasets/mehuldamani/big-math-digits), and utilized their [model](https://huggingface.co/mehuldamani/big-math-digits-v2-brier-base-tabc) post-trained using RLCR on this dataset. I chose this dataset for three reasons:

1. **Ease of intervention**: it is straightforward to inject spurious reasoning steps or alter intermediate calculations in math problems, compared to more open-ended textual datasets like HotPotQA.
2. **Practicality under time constraints**: math problems tend to have shorter prompts and outputs, which allowed me to run more experiments under limited GPU memory and time.
3. **Connection to prior work**: I wanted to experiment with the sentence-type taxonomy introduced in the [*Thought Anchors*](https://arxiv.org/pdf/2506.19143) paper, and since they also worked with math traces, I could bootstrap some of their classification categories.

## Data

In total, I worked with a set of 100 output traces. While I acknowledge this is a small number — and a limitation in terms of statistical power — it was the right trade-off for me given GPU RAM constraints and the need to iterate in the ~12 hour window.

To generate my 100 output traces I took 100 questions from the test set of the [Big-Math Digits](https://huggingface.co/datasets/mehuldamani/big-math-digits) dataset and performed a full model generation with a temperature of 0.7. I have included an example output below of what a complete response to a question from that dataset looks like. 

![Screenshot 2025-08-29 at 5.58.07 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_5.58.07_PM.png)

In the rest of this post, I will refer to each block as the ***think, answer, analysis***, and ***confidence*** section.

## Method: Error Injection

To test what actually drives the *confidence* score and associated *analysis* section, I wanted to come up with an experiment to test how the *confidence* and *analysis* is affected when we artificially add different kinds of uncertainty to the *think* section. 

In order to generate this uncertainty in the *think* section I devised two seperate error injection tests:

1. **Logical Errors**
    - I edited reasoning traces by injecting three small but meaningful mistakes.
    - Examples included altering a number in an intermediate step (e.g., writing 12 instead of 21), redefining a formula incorrectly ($\sin\theta = \tfrac{\text{opp}}{\text{hyp}}\;\;\to\;\; \sin\theta = \tfrac{\text{hyp}}{\text{opp}}$) or inserting an arithmetic slip.
    - Importantly I did not propagate the errors forward. The final answer remained correct, so any confidence changes would have to come from the internal recognition that “something along the way didn’t add up.”
    - With these logical errors I wanted to see if the model is truly caring about the validity of the underlying *think* trace.

![Screenshot 2025-08-29 at 7.10.25 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_7.10.25_PM.png)

1. **Grammatical Errors**
    - I injected purely surface level noise, such as misspellings (“equation” → “equashen”), grammatical slips (“we are” → “we is”), bad punctuation, odd capitalization, repetition, and simple homophone swaps (their → they’re).
    - These perturbations did not affect the logic of the trace at all.
    - The grammatical errors are a way to see if mistakes unrelated to the validitiy of the *think* reasoning actually have any affect on the *confidence* or *analysis*.

![Screenshot 2025-08-29 at 7.19.20 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_7.19.20_PM.png)

- How did I generate the injections?
    
    In order to generate these error injections I used [gpt-5-mini](https://platform.openai.com/docs/models/gpt-5-mini). I verified that gpt-5-mini was indeed injected these errors each time using a simple Regex based checker
    

For both conditions, I re generated outputs with a non-zero temperature of 0.7. To reduce noise from stochasticity, I repeated each experiment five times and took the output that had the majority *confidence* score. If no entry had the majority I picked a random output trace. Importantly, I wanted to test whether the confidence and associated analysis were actually concerned with important intermediate logical errors which should reduce confidence in the final answer vs small grammatical errors that have no bearing on the overal logical steps. 

## Results: Logical Errors

The logical error injection produced some interesting findings:

- 29% of traces experienced a drop in confidence when logical errors were introduced.
- The mean decrease among those cases was −0.2 points.
- A majority (62%) showed no change at all.
    
    ![Screenshot 2025-08-29 at 6.08.40 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_6.08.40_PM.png)
    

| Category | Count | Avg Change | Range |
| --- | --- | --- | --- |
| All traces | 100 | -0.0485 | -0.500 to 0.200 |
| Changed (any direction) | 38 | -0.1276 | -0.500 to 0.200 |
| Decreased only | 29 | -0.2086 | -0.500 to -0.100 |
| Increased only | 9 | 0.1333 | 0.100 to 0.200 |

These results point towards the fact that the model’s produced confidence score is negatively affected by injection of logical errors into the mathematical elements of the think trace. Interestingly, when I scale up the number of logical errors from 3 to 6 there is relatively little change in both the number of traces affected across each category and also the average change. Furthermore, 62% of samples show the same direction of affect between the 3 and 6 error setting - meaning there is some correlation between the kinds of samples that are affected by logical error injection.  Perhaps on more complicated questions, small errors are much harder to spot. 

![Screenshot 2025-08-29 at 8.53.27 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_8.53.27_PM.png)

- Note on correlation
    
    This 62% agreement rate is statistically significant (p < 0.001) and represents a moderate correlation (r = 0.42)
    

The next question is whether the  model honestly verbalizes the reasons for these negative changes in its traces.

### Decreased Examples: Did the model verbally acknowledge the logical errors?

We have evidence that the model confidence score is negatively impacted by logical error injection. However, did it manage to accurately capture these errors in natural language in its *analysis section?*

If we analyze the the 29 samples which saw a negative decrease in confidence score we find that 22 out of 29 of them explicitly mention one of the three injected errors. 

![Screenshot 2025-08-29 at 6.35.14 PM.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/Screenshot_2025-08-29_at_6.35.14_PM.png)

Amongst the unchanged and increased category we see much fewer mentions, which makes sense. 

|  | Mentioned Error | Didn't Mention Error | Total Traces | % Mentioned |
| --- | --- | --- | --- | --- |
| Increased conf | 0 | 9 | 9 | 0% |
| Unchanged conf | 5 | 57 | 62 | 8.1% |
| **Decreased conf** | **22** | **7** | **29** | **75.9%** |
| Total | 27 | 73 | 100 | 27% |

### Why so many Unchanged Traces?

In the unchanged cases, very few analysis traces (5 out of 62) even mentioned the injected errors. This suggests that while the model sometimes notices and penalizes errors, it is often blind to them. I also expected to see more explicit mentions of an error in the cases where the confidence score dropped.

To dig deeper into why so few analysis sections referenced the errors (27 total) I examined where the tokens in the *analysis* section were attending within the *think* trace. My goal was to understand what types of sentences the analysis section as a whole was focusing on. Since the analysis sections acknowledge injected errors less frequently than the confidence scores penalize them, my hypothesis was that they might be "looking at" different parts of the reasoning trace.

Because I wanted to look at this at the sentence level and more specifically, wanted to understand the types of sentences each section was attending to, I leveeraged the ideas from the [*Thought Anchors*](https://arxiv.org/pdf/2506.19143) paper. Specifically, for my use case I did the following:

1. **Sentence Segmentation and Categorization:** I split the text within the *think* section into chunks and classified them using the *Thought Anchors* taxonomy (problem understanding, solution steps, verification, etc.).
2. **Attention Extraction:** I then extracted attention patterns from the model's final layer, focusing on how tokens in the ***analysis*** section attended back to the *think* section. I then aggregated token-level weights into sentence-level scores by summing attention across each sentence span.
3. **Category-Level Analysis:** I aggregated sentence-level scores by category to compute how much attention the ***analysis*** section gave to each type of reasoning (problem setup vs. calculation vs. error checking).
4. **Top-K Sentence Categories:** For each trace, I identified the top-3 sentences in the *think* section that received the highest attention from the *analysis* section, and then recorded the categories those sentences belonged to. This let me see which types of reasoning content dominated the analysis-to-think attention focus.
- Why extract attention from the final layer?
    
    While I could have picked from any of the 32 layers, I chose the final layer as I wanted a high level notion of categories and layers later on typically focus on a larger set of aggregated features. Moreover, I didn’t choose a specific head from the final layer. Instead I simply averaged the attention map from all heads. 
    

The results showed a striking pattern: the *analysis* sections primarily attended to *plan generation*, *fact retrieval* and *problem setup*  whereas the confidence section is attending far more to the active computation sentences. This suggests that the analysis generation operates at a more abstract level, emphasizing overall coherence rather than step-by-step checking. Mechanistically, this helps explain why analysis sections often fail to explicitly acknowledge errors, even when the confidence scores are appropriately penalized—they are literally not "looking" at the errorful parts of the reasoning trace. 

Now obviosuly aggregated attention can not so simply be interpreated as just where that individual section is looking. For one thing, we only looked at one layer of attention and also attention patterns are a lot more complex and nuanced than I am describing it as. However, what I wanted to draw attention to (no pun intended) with this analysis was just the difference in these patterns as a potential explanation for the difference in behavior we see in the *confidence* and ***analysis*** sections in response to the error injections.

![category_attention_k3.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/category_attention_k3.png)

- Sentence Taxonomy
    1. **Problem Setup:** Parsing or rephrasing the problem
    2. **Plan Generation:** Stating or deciding on a plan of action, meta-reasoning
    3. **Fact Retrieval:** Recalling facts, formulas, problem details without computation
    4. **Active Computation:** Algebra, calculations, or other manipulations toward the answer
    5. **Uncertainty Management:** Expressing confusion, re-evaluating, including backtracking
    6. **Result Consolidation:** Aggregating intermediate results, summarizing, or preparing
    7. **Self Checking:** Verifying previous steps, checking calculations, and re-confirmations
    8. **Final Answer Emission:** Explicitly stating the final answer

## Results: Grammatical Errors

The grammatical injection produced an even more surprising outcome.

![image.png](Project%20Write%20Up%2025eb1f54be618008b574ec2fc4e6ca7f/image.png)

- Many traces showed drops in confidence, although the average size of the decrease was smaller than in the logical case.
- Crucially, not a single ***analysis*** section mentioned grammar, spelling, or punctuation as a reason in its analysis section.
- Even after manually checking all affected samples, I confirmed that none of the confidence justifications pointed to these surface changes.

| Category | Count | Avg Change | Range |
| --- | --- | --- | --- |
| All traces | 100 | -0.0070 | -0.300 to 0.500 |
| Changed (any direction) | 36 | -0.0194 | -0.300 to 0.500 |
| Decreased only | 23 | -0.1565 | -0.300 to -0.100 |
| Increased only | 13 | 0.2231 | 0.100 to 0.500 |

## Why do grammatical errors cause drops?

The most plausible explanation I can think of is distributional. During pretraining, LLMs develop a strong sense of grammatically correct language, especially within domains where pretraining data contains a lot of accurate language like in mathematical reasoning contexts. During RL fine-tuning for reasoning, the traces are clean and fluent. As a result, when the model sees something linguistically unusual, it implicitly treats it as “out of distribution,” which in turn lowers its internal confidence signal.

The striking part is that this happens without any reflection in the analysis text. The confidence mechanism “knows something is off,” but the analysis channel is not able to verbalize why. This is one of the reasons why chain of thought reasoning has been under so much scrutiny recently - it is very often the case that what a model verbalizes and the udnerlying processes are different. 

- If I had more time 😅
    
    I would like to run a finer-grained attribution study: tracing attention from the confidence head to the specific tokens containing errors, and measuring whether those tokens disproportionately influence the confidence output. This could help explain whether the model’s calibration is being skewed by surface features.
    

## Conclusion

This study suggests that confidence scores in the RLCR models are not purely a reflection of logical correctness. Instead, they can be very easily shaped by a mix of shallow distributional cues and occasional recognition of explicit errors.

Moreover, these logical mistakes sometimes lower confidence, but often go unnoticed. Grammatical mistakes, which have no effect on logic, can also cause confidence drops, even though the model never acknowledges them in its explanations.

This raises an important interpretability concern: these confidence values may not be as “reason-based” as they appear, and their accompanying analysis traces can be misleading. If these models are to be used in safety-critical contexts, we need to develop better tools to understand and audit the signals driving calibration.

## Limitations and Reflections

This project was necessarily small in scale. Working with only 100 samples meant that I could not make broad statistical claims, and the limited number of re-generations meant there is always some uncertainty from randomness. GPU memory constraints also shaped my choices, both in the size of the dataset I selected and in the kinds of experiments I could feasibly run in 12 hours. These are practical trade-offs, but they also helped me think carefully about how to design interventions that could be maximally revealing despite the constraints.

What surprised me most was how consistently grammatical noise lowered confidence without ever being mentioned in the analysis traces. Going into the project I expected the opposite: that logical errors would dominate the signal, and grammar would be ignored. Instead, I came away with a new appreciation for how much calibration can be tied to distributional cues that have little to do with the reasoning itself. That feels like both a warning sign and an opportunity for deeper mechanistic study.

If I had more time, I would push further in three directions. First, expanding the dataset and running more systematic error injections to confirm these patterns. Second, diving into token-level attribution to see if grammatical perturbations disproportionately attract attention in the confidence head. And third, experimenting with targeted edits to the sentence categories most influential for confidence (plan generation, fact retrieval, problem setup) to see whether the model’s calibration can be shifted in predictable ways.