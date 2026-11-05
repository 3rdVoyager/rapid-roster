# Archived Example League Data and Rules

> Archived reference material. The current rule design is documented in
> [keyword-rule-schema.md](keyword-rule-schema.md).

## Rule Schema Examples

### Rules at a Glance

1. Each item's gender must equal the division gender of the slot to which it is assigned.
2. Each item's division must equal the division of the slot to which it is assigned.
3. Each item's available practice nights must contain the practice night of each slot to which it is assigned.
4. Each item's coach's child request must equal the ID of the slot to which it is assigned.
5. Each slot's assigned item count must be within 2 of the minimum assigned item count across all slots.
6. Each slot's average assigned-item height should be close to the overall item height average.
7. The selected tallest items should be distributed evenly among the slots.
8. Each item's requested teammate should match the ID of each item assigned to the same slot.
9. Each item's coach request should match the ID of the slot to which it is assigned.
10. Each item's sibling's slot's practice night should match the practice night of the slot to which it is assigned.
11. Each item's sibling's slot's gym location should match the gym location of the slot to which it is assigned.
12. Each slot's average assigned-item evaluation score should be close to the overall item evaluation score average.

### Hard Rules

```json
[
  {
    "id": "R1",
    "name": "Match Gender",
    "description": "For each item, the gender must equal the division gender of the assigned slot.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "gender"
        },
        "operator": "equals",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "divisionGender"
          }
        }
      },
      "enforcement": "hard"
    }
  },
  {
    "id": "R2",
    "name": "Match Division",
    "description": "For each item, the division must equal the division of the assigned slot.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "division"
        },
        "operator": "equals",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "division"
          }
        }
      },
      "enforcement": "hard"
    }
  },
  {
    "id": "R3",
    "name": "Match Available Practice Nights",
    "description": "For each item, the practice nights must include the practice night of the assigned slot.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "practiceNights"
        },
        "operator": "contains",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "practiceNight"
          }
        }
      },
      "enforcement": "hard"
    }
  },
  {
    "id": "R4",
    "description": "For each item, the coach's child request must match the ID of the assigned slot.",
    "name": "Honor Coach's Child Request",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "coachChildRequest"
        },
        "operator": "equals",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "id"
          }
        }
      },
      "enforcement": "hard"
    }
  },
  {
    "id": "R5",
    "name": "Balance Team Sizes",
    "description": "The assigned item counts of any two slots must differ by no more than one.",
    "config": {
      "source": {
        "collection": "slots",
        "forEach": {
          "collection": "assignments",
          "calculations": ["count"]
        },
        "calculations": ["max", "subtract(2)"]
      },
      "operator": "lessThan",
      "target": {
        "collection": "slots",
        "forEach": {
          "collection": "assignments",
          "calculations": ["count"]
        },
        "calculations": ["min"]
      },
      "enforcement": "hard"
    }
  }
]
```

### Soft Rules

```json
[
  {
    "id": "R6",
    "name": "Balance Average Heights",
    "description": "Each slot's average assigned-item height should be close to the overall item height average.",
    "config": {
      "collection": "slots",
      "forEach": {
        "source": {
          "collection": "assignments",
          "forEach": {
            "attribute": "height"
          },
          "calculations": ["average"]
        },
        "operator": "approximates",
        "target": {
          "collection": "items",
          "forEach": {
            "attribute": "height"
          },
          "calculations": ["average"]
        }
      },
      "enforcement": "soft",
      "priority": 80
    }
  },
  {
    "id": "R7",
    "name": "Distribute Tallest Players",
    "description": "The selected tallest items should be distributed evenly among the slots.",
    "config": {
      "collection": "slots",
      "forEach": {
        "source": {
          "collection": "assignments",
          "select": [
            "P1",
            "P3",
            "P4",
            "P6",
            "P7",
            "P8",
            "P9",
            "P10",
            "P11",
            "P12"
          ],
          "calculations": ["count"]
        },
        "operator": "approximates",
        "target": 2
      },
      "enforcement": "soft",
      "priority": 80
    }
  },
  {
    "id": "R8",
    "name": "Honor Teammate Requests",
    "description": "Each item should share at least one assigned slot with each requested teammate.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "teammateRequest",
          "forEach": {
            "lookup": {
              "collection": "assignments",
              "forEach": {
                "attribute": "id"
              }
            }
          }
        },
        "operator": "overlaps",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "id"
          }
        }
      },
      "enforcement": "soft",
      "priority": 75
    }
  },
  {
    "id": "R9",
    "name": "Honor Coach Requests",
    "description": "An item with a coach request should be assigned to the requested slot.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "coachRequest"
        },
        "operator": "equals",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "id"
          }
        }
      },
      "enforcement": "soft",
      "priority": 60
    }
  },
  {
    "id": "R10",
    "name": "Match Sibling Practice Nights",
    "description": "Sibling items should be assigned to slots with the same practice night.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "sibling",
          "forEach": {
            "lookup": {
              "collection": "assignments",
              "forEach": {
                "attribute": "practiceNight"
              }
            }
          }
        },
        "operator": "overlaps",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "practiceNight"
          }
        }
      },
      "enforcement": "soft",
      "priority": 65
    }
  },
  {
    "id": "R11",
    "name": "Match Sibling Gym",
    "description": "Sibling items should be assigned to slots at the same gym location.",
    "config": {
      "collection": "items",
      "forEach": {
        "source": {
          "attribute": "sibling",
          "forEach": {
            "lookup": {
              "collection": "assignments",
              "forEach": {
                "attribute": "gymLocation"
              }
            }
          }
        },
        "operator": "overlaps",
        "target": {
          "collection": "assignments",
          "forEach": {
            "attribute": "gymLocation"
          }
        }
      },
      "enforcement": "soft",
      "priority": 65
    }
  },
  {
    "id": "R12",
    "name": "Balance Evaluation Scores",
    "description": "Each slot's average assigned-item evaluation score should be close to the overall item evaluation score average.",
    "config": {
      "collection": "slots",
      "forEach": {
        "source": {
          "collection": "assignments",
          "forEach": {
            "attribute": "evaluationScore"
          },
          "calculations": ["average"]
        },
        "operator": "approximates",
        "target": {
          "collection": "items",
          "forEach": {
            "attribute": "evaluationScore"
          },
          "calculations": ["average"]
        }
      },
      "enforcement": "soft",
      "priority": 100
    }
  }
]
```
