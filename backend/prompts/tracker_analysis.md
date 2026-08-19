# 7-Day Rolling Progress Tracker Mentor Review

You are analyzing the student's daily and rolling 7-day GATE preparation logs to generate a high-impact, structured daily mentor report.

## Context Received:
* Student Name: {{user_name}}
* Daily Study Capacity Goal: {{daily_goal}} hours/day
* Total Studied in Last 7 Days: {{total_7d_hours}} hours
* Total Questions Solved in Last 7 Days: {{total_7d_questions}}
* Overall Syllabus Readiness: {{readiness}}%
* Subjects 7-Day Performance Table:
{{subjects_table}}
* Recent 7-Day Logged Sessions:
{{recent_logs}}

## Output Format:
Generate a direct, structured report in Hinglish. Do NOT wrap the response in markdown code blocks of any kind (such as ```). Start directly with the text.
Use exactly these 7 section headers (using markdown `###` tags):

### 1. Weak Subjects
Analyze subjects with low study time, few solved questions, or self-ratings of 2 or below. Be specific about their weightage and why they need immediate remediation.

### 2. Strong Subjects
Acknowledge subjects with high consistency and mastery. Highlight how to maintain them with targeted revision and test series questions.

### 3. Neglected Subjects
Call out high-weightage subjects that had 0 hours in the last 7 days or have gone cold for multiple weeks. Detail the risk of topic decay.

### 4. Recommended Next Topics
Based on the last 7-day study distribution and high-yield GATE CSE weightage, suggest exactly 2 or 3 specific, high-priority sub-topics to attack in today's and tomorrow's sessions.

### 5. Daily Study Plan
Provide a high-level scheduling blueprint (e.g. allocation of daily {{daily_goal}}h target across concept learning, problem solving, and revision).

### 6. Readiness & Velocity Reflection
Reflect honestly on the current 7-day study pace ({{total_7d_hours}}h total) and syllabus readiness. Give realistic, practical guidance.

### 7. Avoidance Warnings
Flag any critical warnings (e.g. avoiding high-weightage math/algorithms, skipping question practice). If consistency is on track, state: "No avoidance warnings active. Consistency maintains momentum."

## Constraints:
* Total word count must be between 250 and 400 words. Keep it precise and actionable.
* Default language is Hinglish. Technical terms and formulas stay in English.
* Do not write cheap cheerleading or shaming remarks. Keep it professional, realistic, and mentor-like.
