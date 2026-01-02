export interface ProblemTemplate {
  id: string;
  name: string;
  description: string;
  defaultDescription: string;
  defaultCostFunction: string;
  defaultTestInputGenerator?: string;
  hasSymbolInput?: boolean;
  hasCityInput?: boolean;
  hasDelayHours?: boolean;
  symbolLabel?: string;
  symbolPlaceholder?: string;
  defaultDelay?: number;
}

export const PROBLEM_TEMPLATES: ProblemTemplate[] = [
  {
    id: "optimization",
    name: "Optimization (Classic)",
    description: "Random numeric inputs - classic algorithm competition format",
    defaultDescription: `# Optimization Problem

Given a list of numbers as input, your algorithm should find the optimal output that minimizes the cost function.

## Input Format
You will receive a list of numbers: \`test_input\`

## Output Format
Return a single number that minimizes the cost.

## Cost Function
The cost is calculated based on how close your solution is to the optimal value.
`,
    defaultCostFunction: `def cost(test_input, solution_output):
    # Calculate how far the solution is from optimal
    # Lower cost = better solution
    expected = sum(test_input)  # Example: expected output
    return abs(solution_output - expected)`,
  },
  {
    id: "stock_prediction",
    name: "Stock Prediction",
    description: "Predict stock prices - uses built-in stock data fetcher",
    defaultDescription: `# Stock Price Prediction

Predict the future stock price based on the current market data.

## Input Format
You will receive:
\`\`\`python
{
    "symbol": "AAPL",
    "price": 185.50,      # Current price at deadline
    "timestamp": "..."
}
\`\`\`

## Output Format
Return your predicted price as a single number.

## Evaluation
After the prediction window, your prediction will be compared to the actual price.
Cost = absolute difference between prediction and actual price.
`,
    defaultCostFunction: `def cost(test_input, solution_output):
    # The actual future price will be fetched at evaluation time
    # This cost function compares your prediction to the actual outcome
    actual_price = test_input.get("future_price", test_input["price"])
    return abs(actual_price - solution_output)`,
    defaultTestInputGenerator: `def generate_test_input():
    # Fetches current stock data at deadline
    return fetch_stock("{{SYMBOL}}")`,
    hasSymbolInput: true,
    hasDelayHours: true,
    symbolLabel: "Stock Symbol",
    symbolPlaceholder: "AAPL",
    defaultDelay: 24,
  },
  {
    id: "crypto_prediction",
    name: "Crypto Prediction",
    description: "Predict cryptocurrency prices - higher volatility challenge",
    defaultDescription: `# Cryptocurrency Price Prediction

Predict the future cryptocurrency price based on current market data.

## Input Format
You will receive:
\`\`\`python
{
    "symbol": "BTC",
    "price": 95000.00,     # Current price at deadline
    "timestamp": "..."
}
\`\`\`

## Output Format
Return your predicted price as a single number.

## Evaluation
After the prediction window, your prediction will be compared to the actual price.
Cost = absolute difference between prediction and actual price.

Note: Crypto is highly volatile - factor this into your predictions!
`,
    defaultCostFunction: `def cost(test_input, solution_output):
    actual_price = test_input.get("future_price", test_input["price"])
    return abs(actual_price - solution_output)`,
    defaultTestInputGenerator: `def generate_test_input():
    return fetch_crypto("{{SYMBOL}}")`,
    hasSymbolInput: true,
    hasDelayHours: true,
    symbolLabel: "Crypto Symbol",
    symbolPlaceholder: "BTC",
    defaultDelay: 24,
  },
  {
    id: "weather_forecast",
    name: "Weather Forecast",
    description: "Predict weather conditions - temperature prediction challenge",
    defaultDescription: `# Weather Forecast Prediction

Predict the temperature for a given city after the prediction window.

## Input Format
You will receive:
\`\`\`python
{
    "city": "New York",
    "temp_f": 45,          # Current temperature (Fahrenheit)
    "temp_c": 7,           # Current temperature (Celsius)
    "conditions": "cloudy",
    "humidity": 65,
    "timestamp": "..."
}
\`\`\`

## Output Format
Return your predicted temperature in Fahrenheit as a single number.

## Evaluation
After the prediction window, your forecast will be compared to actual temperature.
Cost = absolute difference between predicted and actual temperature.
`,
    defaultCostFunction: `def cost(test_input, solution_output):
    actual_temp = test_input.get("future_temp_f", test_input["temp_f"])
    return abs(actual_temp - solution_output)`,
    defaultTestInputGenerator: `def generate_test_input():
    return fetch_weather("{{CITY}}")`,
    hasCityInput: true,
    hasDelayHours: true,
    symbolLabel: "City Name",
    symbolPlaceholder: "New York",
    defaultDelay: 24,
  },
  {
    id: "custom",
    name: "Custom (Advanced)",
    description: "Write your own test input generator in Python",
    defaultDescription: `# Custom Problem

Define your own test input generation and cost function.

## Test Input
Your custom Python generator will create the test input at deadline.

## Solution Format
Solvers will implement \`solve(test_input)\` and return their solution.

## Cost Function
Define how to score solutions - lower cost = better.
`,
    defaultCostFunction: `def cost(test_input, solution_output):
    # Define how to calculate the cost
    # Lower cost = better solution
    return abs(test_input - solution_output)`,
    defaultTestInputGenerator: `def generate_test_input():
    # Return the test input for solutions
    # You can use built-in fetchers:
    # - fetch_stock("AAPL")
    # - fetch_crypto("BTC")
    # - fetch_weather("New York")
    # - fetch_random(min, max, count)
    return fetch_random(0, 100, 1)`,
  },
];

export function getTemplate(id: string): ProblemTemplate | undefined {
  return PROBLEM_TEMPLATES.find((t) => t.id === id);
}

export function getDefaultTemplate(): ProblemTemplate {
  return PROBLEM_TEMPLATES[0];
}
