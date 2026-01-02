-- Modify problems table for algorithm-based system
ALTER TABLE public.problems 
  DROP COLUMN IF EXISTS intended_answer,
  DROP COLUMN IF EXISTS units,
  DROP COLUMN IF EXISTS expected_scale,
  ADD COLUMN IF NOT EXISTS cost_function TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS test_inputs_range JSONB NOT NULL DEFAULT '{"min": 0, "max": 100, "count": 1}'::jsonb,
  ADD COLUMN IF NOT EXISTS test_input JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS time_penalty_per_ms NUMERIC NOT NULL DEFAULT 0.001;

-- Modify solutions table for algorithm-based system
ALTER TABLE public.solutions
  DROP COLUMN IF EXISTS answer,
  DROP COLUMN IF EXISTS error,
  ADD COLUMN IF NOT EXISTS algorithm TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS output JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cost NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS execution_time_ms NUMERIC DEFAULT NULL;