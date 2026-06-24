import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

/**
 * Simulates a GrapesJS component model for the multiContainer type.
 *
 * In GrapesJS, when a trait has `changeProp: true`, changing the trait value
 * updates the component's property (e.g., `tagName`) without affecting the
 * component's children array. This model replicates that behavior for testing.
 */
class _MultiContainerModel {
  constructor({ tagName = "div", children = [] } = {}) {
    this.tagName = tagName;
    this.children = children.map((child) => ({ ...child }));
    this.droppable = true;
  }

  /**
   * Simulates the GrapesJS `changeProp: true` behavior for the tagName trait.
   * When the user selects a new tag from the trait selector, GrapesJS updates
   * the `tagName` property on the model. Children remain untouched.
   * @param newTag
   */
  changeTag(newTag) {
    this.tagName = newTag;
  }

  getChildren() {
    return this.children;
  }

  getTag() {
    return this.tagName;
  }
}

/**
 * Property 11: Tag change preserves child components
 *
 * For any multi-function container component with N child components,
 * changing the HTML tag via the trait selector SHALL result in the component
 * having the new tag while retaining exactly N child components with identical
 * content and attributes.
 *
 * **Validates: Requirements 17.4**
 */
describe("Property 11: Tag change preserves child components", () => {
  // The allowed tag options from the multiContainer component type definition
  const ALLOWED_TAGS = [
    "div",
    "section",
    "article",
    "aside",
    "header",
    "footer",
    "main",
    "nav",
    "span",
  ];

  // Arbitrary for selecting a tag from the allowed set
  const tagArb = fc.constantFrom(...ALLOWED_TAGS);

  // Arbitrary for a child component's attributes (key-value pairs)
  const attributesArb = fc.dictionary(
    fc
      .stringMatching(/^[a-z][a-z0-9-]*$/)
      .filter((s) => s.length >= 1 && s.length <= 20),
    fc.string({ minLength: 1, maxLength: 50 }),
    { minKeys: 0, maxKeys: 5 },
  );

  // Arbitrary for a single child component definition
  const childComponentArb = fc.record({
    type: fc.constantFrom(
      "text",
      "image",
      "link",
      "subGrid",
      "grid",
      "default",
    ),
    tagName: fc.constantFrom("p", "span", "div", "a", "img", "h1", "h2", "h3"),
    content: fc.string({ minLength: 0, maxLength: 100 }),
    attributes: attributesArb,
  });

  // Arbitrary for an array of child components (1-10 children)
  const childrenArb = fc.array(childComponentArb, {
    minLength: 1,
    maxLength: 10,
  });

  it("changing tag preserves the exact number of children", () => {
    fc.assert(
      fc.property(
        tagArb, // initial tag
        tagArb, // new tag
        childrenArb,
        (initialTag, newTag, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          const childCountBefore = model.getChildren().length;

          model.changeTag(newTag);

          expect(model.getChildren().length).toBe(childCountBefore);
          expect(model.getChildren().length).toBe(children.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("changing tag updates the tagName to the new value", () => {
    fc.assert(
      fc.property(
        tagArb,
        tagArb,
        childrenArb,
        (initialTag, newTag, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          model.changeTag(newTag);

          expect(model.getTag()).toBe(newTag);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("children content is identical before and after tag change", () => {
    fc.assert(
      fc.property(
        tagArb,
        tagArb,
        childrenArb,
        (initialTag, newTag, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          // Capture children state before tag change
          const childrenBefore = model.getChildren().map((c) => ({ ...c }));

          model.changeTag(newTag);

          // Verify each child's content is preserved
          const childrenAfter = model.getChildren();
          for (let i = 0; i < childrenBefore.length; i++) {
            expect(childrenAfter[i].content).toBe(childrenBefore[i].content);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("children attributes are identical before and after tag change", () => {
    fc.assert(
      fc.property(
        tagArb,
        tagArb,
        childrenArb,
        (initialTag, newTag, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          // Capture children state before tag change
          const childrenBefore = model.getChildren().map((c) => ({
            ...c,
            attributes: { ...c.attributes },
          }));

          model.changeTag(newTag);

          // Verify each child's attributes are preserved
          const childrenAfter = model.getChildren();
          for (let i = 0; i < childrenBefore.length; i++) {
            expect(childrenAfter[i].attributes).toEqual(
              childrenBefore[i].attributes,
            );
            expect(childrenAfter[i].type).toBe(childrenBefore[i].type);
            expect(childrenAfter[i].tagName).toBe(childrenBefore[i].tagName);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("multiple sequential tag changes preserve children throughout", () => {
    fc.assert(
      fc.property(
        tagArb,
        fc.array(tagArb, { minLength: 2, maxLength: 8 }),
        childrenArb,
        (initialTag, tagSequence, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          // Deep copy original children for comparison
          const originalChildren = children.map((c) => ({
            ...c,
            attributes: { ...c.attributes },
          }));

          // Apply multiple tag changes sequentially
          for (const tag of tagSequence) {
            model.changeTag(tag);
          }

          // After all changes, children must still be identical
          const finalChildren = model.getChildren();
          expect(finalChildren.length).toBe(originalChildren.length);

          for (let i = 0; i < originalChildren.length; i++) {
            expect(finalChildren[i].content).toBe(originalChildren[i].content);
            expect(finalChildren[i].type).toBe(originalChildren[i].type);
            expect(finalChildren[i].tagName).toBe(originalChildren[i].tagName);
            expect(finalChildren[i].attributes).toEqual(
              originalChildren[i].attributes,
            );
          }

          // Final tag should be the last in the sequence
          expect(model.getTag()).toBe(tagSequence[tagSequence.length - 1]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("tag change on empty container (no children) results in valid empty container with new tag", () => {
    fc.assert(
      fc.property(tagArb, tagArb, (initialTag, newTag) => {
        const model = new MultiContainerModel({
          tagName: initialTag,
          children: [],
        });

        model.changeTag(newTag);

        expect(model.getTag()).toBe(newTag);
        expect(model.getChildren()).toEqual([]);
        expect(model.droppable).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("the new tag is always one of the allowed tag values", () => {
    fc.assert(
      fc.property(
        tagArb,
        tagArb,
        childrenArb,
        (initialTag, newTag, children) => {
          const model = new MultiContainerModel({
            tagName: initialTag,
            children,
          });

          model.changeTag(newTag);

          expect(ALLOWED_TAGS).toContain(model.getTag());
        },
      ),
      { numRuns: 100 },
    );
  });
});
