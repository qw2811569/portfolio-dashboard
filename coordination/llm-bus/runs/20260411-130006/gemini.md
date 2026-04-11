Gemini CLI needed one quota retry before producing a usable answer.

CHOICE: A
WHY: This option offers an automatic trigger with safeguards like cooldown and confirmation of all datasets, which prevents API abuse and ensures data readiness. It keeps the logic aligned with the earlier requirement to gate on real data instead of time.
RISKS: latency due to cooldown, delayed updates if not all datasets confirm, possible over-probing if the user frequently re-mounts the panel
TESTS: verify the cooldown mechanism, test the all-datasets-confirmed logic, ensure auto-run occurs only when conditions are met, test scenarios where not all datasets confirm
