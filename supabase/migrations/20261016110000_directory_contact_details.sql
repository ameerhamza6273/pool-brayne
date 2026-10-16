-- Client SMS 2026-10-16: "need to set up a phone contact under data, with name / description /
-- phone number / email, also make this visible in tech view" -- the existing Directory feature
-- (directory_contacts, built 2026-09-02, its own purpose comment already says "for techs to look
-- up on the road") already covers name/phone; adds the two missing fields rather than building a
-- second contacts table. "Role" is kept too (an earlier contact may already have one set).
alter table directory_contacts add column description text;
alter table directory_contacts add column email text;
