# Source Parameters

There are two major ways to send parameters to a source: by sending the inputs from an entire form, and by sending selected individual inputs.  The two methods result in slightly different behavior, so while the tests are broadly the same, they do have individual tweaks.

## Form Method

* Also gathers unrelated inputs such as the "group mode" (i.e. summary vs. details) radio buttons.
* Can't tell whether a checkbox should be interpreted normally or as a toggle, so it conforms to standard HTML form submission semantics.

## Individual Method

* Only captures the inputs specified.
* Fully supports sending toggle checkboxes as "on" or "off."
