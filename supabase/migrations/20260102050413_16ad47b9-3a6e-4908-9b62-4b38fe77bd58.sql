-- Add new columns to problems table for Python test input generators and templates
ALTER TABLE public.problems 
ADD COLUMN IF NOT EXISTS test_input_generator TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS problem_type TEXT DEFAULT 'optimization',
ADD COLUMN IF NOT EXISTS data_source_config JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS evaluation_delay_hours INTEGER DEFAULT 0;

-- Add comment explaining columns
COMMENT ON COLUMN public.problems.test_input_generator IS 'Python code defining generate_test_input() function';
COMMENT ON COLUMN public.problems.problem_type IS 'Template type: optimization, stock_prediction, crypto_prediction, weather_forecast, custom';
COMMENT ON COLUMN public.problems.data_source_config IS 'Configuration for built-in data fetchers (e.g., {symbol: "AAPL", delay_hours: 24})';
COMMENT ON COLUMN public.problems.evaluation_delay_hours IS 'Hours to wait after deadline before final evaluation (for prediction problems)';