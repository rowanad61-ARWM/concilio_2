-- Round 4 Prompt 2.1.1: parked_fact indexes missed from truncated prompt paste.

CREATE INDEX idx_parked_fact_status ON public.parked_fact(status);
CREATE INDEX idx_parked_fact_category_status ON public.parked_fact(category, status);
