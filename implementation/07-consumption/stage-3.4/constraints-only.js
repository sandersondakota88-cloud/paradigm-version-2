  /* ---- Domain definition (loan eligibility - canonical reference domain) */
  var dims = Object.freeze([
    Object.freeze({ name: "credit",     values: Object.freeze(["prime","near-prime","sub-prime"]) }),
    Object.freeze({ name: "product",    values: Object.freeze(["mortgage","personal","auto","business-line"]) }),
    Object.freeze({ name: "applicant",  values: Object.freeze(["individual","joint","business","trust"]) }),
    Object.freeze({ name: "residency",  values: Object.freeze(["domestic","foreign","diplomatic"]) }),
    Object.freeze({ name: "income",     values: Object.freeze(["under50","50to100","100to250","over250"]) }),
    Object.freeze({ name: "employment", values: Object.freeze(["employed","self-employed","retired","student","unemployed"]) })
  ]);

  var probConfig = Object.freeze({
    maxPositions: 30,
    alphabet: "abcdefghijklmnopqrstuvwxyz",
    spaceMin: 2,
    spaceMax: 15,
    spaceCode: 26
  });

  /* ---- Constraints: WHEN -> THEN rules ------------------------------------
   * Every dim name must be a known dim name.
   * Every value must appear in that dim's values list.
   * rt, doc, reg are plain CSS idents; deny is an arbitrary string (escaped).
   * sdf is -1 (inside valid) or 1 (denied).
   */
  var constraints = Object.freeze([
    /* Credit tier defaults */
    { when: { credit: "prime"      }, then: { rt: "A-PREFERRED", rth: 160, doc: "BASIC" } },
    { when: { credit: "near-prime" }, then: { rt: "B-STANDARD",  rth: 130, doc: "ENHANCED" } },
    { when: { credit: "sub-prime"  }, then: { rt: "C-ELEVATED",  rth:  95, doc: "ENHANCED" } },

    /* Residency uplifts */
    { when: { residency: "foreign"     }, then: { doc: "ENHANCED" } },
    { when: { residency: "diplomatic"  }, then: { doc: "MAXIMUM"  } },

    /* Denials */
    { when: { credit: "sub-prime", product: "business-line" },
      then: { sdf: 1, deny: "SubPrime cannot hold BusinessLine" } },
    { when: { residency: "foreign", product: "mortgage", credit: "sub-prime" },
      then: { sdf: 1, deny: "Foreign SubPrime Mortgage not underwriteable" } },
    { when: { employment: "unemployed", product: "mortgage" },
      then: { sdf: 1, deny: "Mortgage requires income source" } },
    { when: { employment: "student", product: "business-line" },
      then: { sdf: 1, deny: "Student cannot hold BusinessLine" } },
    { when: { applicant: "trust", product: "personal" },
      then: { sdf: 1, deny: "Trust cannot hold Personal" } },
    { when: { income: "under50", product: "mortgage" },
      then: { sdf: 1, deny: "Mortgage requires minimum qualifying income" } }
  ].map(Object.freeze));

