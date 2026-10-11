# DREEM generic lesson AI via shared AI-CORE

The Supabase Edge Function `ai-core-lesson-assistant` authenticates a teacher/staff session, verifies school membership with user-scoped RLS, and constructs **only fixed, public generic teaching prompts** (subject, school level and outline/question mode). It does not forward names, learner records, assessment data or school private documents to external providers.

Deploy the function in DREEM's active Supabase project. Configure `AI_CORE_URL` and `AI_CORE_KEY_DREEM` as Supabase Edge secrets with the identical DREEM product key in the independent AI-CORE Render service. The gateway needs verified database readiness and model credentials first. An authenticated UI call may use `supabase.functions.invoke('ai-core-lesson-assistant', {body:{schoolId,subject,level,mode}})`.

This is not yet installed or verified in the live school application; do not treat the file alone as an operational feature. More advanced curriculum intelligence requires verified national curricula, syllabi, student privacy/guardian policies, teacher approval and offline deployment.
